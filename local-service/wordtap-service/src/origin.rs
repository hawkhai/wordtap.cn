use std::net::IpAddr;

use axum::{
    body::Body,
    extract::Request as AxumRequest,
    http::{header, HeaderMap, HeaderValue, Method, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
    Json,
};

use crate::{
    api::GatewayError,
    config::{DOMAIN_OBFUSCATION_KEY, TRUSTED_PUBLIC_DOMAINS},
};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum EndpointScope {
    PublicStatus,
    TrustedWeb,
    LocalTool,
    InstallerOnly,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
enum CallerOriginClass {
    Local,
    TrustedPublic,
}

pub(crate) async fn origin_gate(request: AxumRequest<Body>, next: Next) -> Response {
    let method = request.method().clone();
    let path = request.uri().path().to_string();
    let origin = request
        .headers()
        .get(header::ORIGIN)
        .and_then(|value| value.to_str().ok())
        .map(str::to_string);

    let Some(scope) = endpoint_scope_for_path(&path) else {
        return next.run(request).await;
    };

    if method == Method::OPTIONS {
        return preflight_response(scope, origin.as_deref());
    }

    if !is_request_origin_allowed(scope, origin.as_deref()) {
        return (
            StatusCode::FORBIDDEN,
            Json(GatewayError {
                error: "当前页面不允许调用这个全文朗读服务接口。".to_string(),
            }),
        )
            .into_response();
    }

    let mut response = next.run(request).await;
    append_cors_headers(response.headers_mut(), scope, origin.as_deref());
    response
}

fn preflight_response(scope: EndpointScope, origin: Option<&str>) -> Response {
    if !is_request_origin_allowed(scope, origin) {
        return StatusCode::FORBIDDEN.into_response();
    }

    let mut response = StatusCode::NO_CONTENT.into_response();
    append_cors_headers(response.headers_mut(), scope, origin);
    response
}

fn append_cors_headers(headers: &mut HeaderMap, scope: EndpointScope, origin: Option<&str>) {
    let Some(origin) = origin else {
        return;
    };

    if !is_request_origin_allowed(scope, Some(origin)) {
        return;
    }

    if let Ok(value) = HeaderValue::from_str(origin) {
        headers.insert(header::ACCESS_CONTROL_ALLOW_ORIGIN, value);
    }
    headers.insert(
        header::ACCESS_CONTROL_ALLOW_HEADERS,
        HeaderValue::from_static("content-type"),
    );
    headers.insert(
        header::ACCESS_CONTROL_ALLOW_METHODS,
        HeaderValue::from_static(allowed_methods(scope)),
    );
    headers.insert(
        header::ACCESS_CONTROL_MAX_AGE,
        HeaderValue::from_static("600"),
    );
    headers.append(header::VARY, HeaderValue::from_static("Origin"));
}

fn allowed_methods(scope: EndpointScope) -> &'static str {
    match scope {
        EndpointScope::PublicStatus => "GET, OPTIONS",
        EndpointScope::TrustedWeb | EndpointScope::InstallerOnly => "POST, OPTIONS",
        EndpointScope::LocalTool => "GET, POST, DELETE, OPTIONS",
    }
}

fn endpoint_scope_for_path(path: &str) -> Option<EndpointScope> {
    match path {
        "/v1/status" | "/v1/capabilities" => Some(EndpointScope::PublicStatus),
        "/v1/recipes/speech" | "/v1/recipes/baidu-sug" => Some(EndpointScope::TrustedWeb),
        "/v1/http/exchange" | "/v1/ws/exchange" | "/v1/ws/sessions" => {
            Some(EndpointScope::LocalTool)
        }
        "/v1/lifecycle/shutdown" => Some(EndpointScope::InstallerOnly),
        path if path.starts_with("/v1/ws/sessions/") => Some(EndpointScope::LocalTool),
        _ => None,
    }
}

fn is_request_origin_allowed(scope: EndpointScope, origin: Option<&str>) -> bool {
    let Some(origin) = origin else {
        return true;
    };

    match classify_origin(origin) {
        Some(CallerOriginClass::Local) => scope != EndpointScope::InstallerOnly,
        Some(CallerOriginClass::TrustedPublic) => {
            matches!(
                scope,
                EndpointScope::PublicStatus | EndpointScope::TrustedWeb
            )
        }
        None => false,
    }
}

fn classify_origin(origin: &str) -> Option<CallerOriginClass> {
    let uri = origin.parse::<http::Uri>().ok()?;
    if !matches!(uri.scheme_str(), Some("http" | "https")) {
        return None;
    }

    let host = uri.host()?.trim_matches(['[', ']']).to_ascii_lowercase();
    if is_local_origin_host(&host) {
        return Some(CallerOriginClass::Local);
    }
    if is_trusted_public_origin_host(&host) {
        return Some(CallerOriginClass::TrustedPublic);
    }

    None
}

fn is_local_origin_host(host: &str) -> bool {
    if host == "localhost" || host.ends_with(".localhost") {
        return true;
    }

    let Ok(ip) = host.parse::<IpAddr>() else {
        return false;
    };

    ip.is_loopback()
}

fn is_trusted_public_origin_host(host: &str) -> bool {
    trusted_public_domains().iter().any(|domain| {
        host == domain
            || host
                .strip_suffix(domain)
                .is_some_and(|prefix| prefix.ends_with('.'))
    })
}

fn trusted_public_domains() -> Vec<String> {
    TRUSTED_PUBLIC_DOMAINS
        .iter()
        .map(|domain| {
            domain
                .iter()
                .map(|byte| char::from(byte ^ DOMAIN_OBFUSCATION_KEY))
                .collect()
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn classifies_local_origins() {
        assert_eq!(
            classify_origin("http://localhost:5173"),
            Some(CallerOriginClass::Local)
        );
        assert_eq!(
            classify_origin("http://127.0.0.1:5173"),
            Some(CallerOriginClass::Local)
        );
        assert_eq!(
            classify_origin("http://[::1]:5173"),
            Some(CallerOriginClass::Local)
        );
        assert_eq!(classify_origin("http://192.168.1.20:5173"), None);
        assert_eq!(classify_origin("http://10.0.0.8:5173"), None);
        assert_eq!(classify_origin("http://172.16.0.8:5173"), None);
        assert_eq!(classify_origin("http://[fd00::1]:5173"), None);
        assert_eq!(classify_origin("http://[fe80::1]:5173"), None);
    }

    #[test]
    fn classifies_trusted_public_origins() {
        assert_eq!(
            classify_origin("https://hawkhai.com"),
            Some(CallerOriginClass::TrustedPublic)
        );
        assert_eq!(
            classify_origin("https://www.sunocean.life"),
            Some(CallerOriginClass::TrustedPublic)
        );
        assert_eq!(
            classify_origin("https://app.infsdk.com"),
            Some(CallerOriginClass::TrustedPublic)
        );
        assert_eq!(
            classify_origin("https://wordtap.cn"),
            Some(CallerOriginClass::TrustedPublic)
        );
        assert_eq!(classify_origin("https://evilwordtap.cn"), None);
        assert_eq!(classify_origin("https://wordtap.cn.evil.test"), None);
    }

    #[test]
    fn enforces_policy_by_api() {
        let public = Some("https://wordtap.cn");
        let local = Some("http://127.0.0.1:5173");
        let evil = Some("https://example.com");

        assert!(is_request_origin_allowed(
            EndpointScope::PublicStatus,
            public
        ));
        assert!(is_request_origin_allowed(EndpointScope::TrustedWeb, public));
        assert!(!is_request_origin_allowed(EndpointScope::LocalTool, public));
        assert!(!is_request_origin_allowed(
            EndpointScope::InstallerOnly,
            public
        ));

        assert!(is_request_origin_allowed(
            EndpointScope::PublicStatus,
            local
        ));
        assert!(is_request_origin_allowed(EndpointScope::TrustedWeb, local));
        assert!(is_request_origin_allowed(EndpointScope::LocalTool, local));
        assert!(!is_request_origin_allowed(
            EndpointScope::InstallerOnly,
            local
        ));

        assert!(is_request_origin_allowed(
            EndpointScope::InstallerOnly,
            None
        ));
        assert!(!is_request_origin_allowed(EndpointScope::TrustedWeb, evil));
    }

    #[test]
    fn maps_v1_endpoints_without_legacy_aliases() {
        assert_eq!(
            endpoint_scope_for_path("/v1/status"),
            Some(EndpointScope::PublicStatus)
        );
        assert_eq!(
            endpoint_scope_for_path("/v1/recipes/speech"),
            Some(EndpointScope::TrustedWeb)
        );
        assert_eq!(
            endpoint_scope_for_path("/v1/recipes/baidu-sug"),
            Some(EndpointScope::TrustedWeb)
        );
        assert_eq!(
            endpoint_scope_for_path("/v1/http/exchange"),
            Some(EndpointScope::LocalTool)
        );
        assert_eq!(
            endpoint_scope_for_path("/v1/ws/sessions/example/recv"),
            Some(EndpointScope::LocalTool)
        );
        assert_eq!(
            endpoint_scope_for_path("/v1/lifecycle/shutdown"),
            Some(EndpointScope::InstallerOnly)
        );
        assert_eq!(endpoint_scope_for_path("/health"), None);
        assert_eq!(endpoint_scope_for_path("/tts"), None);
        assert_eq!(endpoint_scope_for_path("/edge-readaloud"), None);
        assert_eq!(endpoint_scope_for_path("/shutdown"), None);
    }
}
