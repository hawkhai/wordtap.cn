#[cfg(windows)]
fn main() {
    let version = env!("CARGO_PKG_VERSION");
    let mut resource = winresource::WindowsResource::new();
    resource
        .set_icon("../../public/favicon.ico")
        .set("FileDescription", "WordTap 全文朗读服务")
        .set("ProductName", "WordTap 全文朗读服务")
        .set("CompanyName", "WordTap")
        .set("Comments", "Official website: wordtap.cn")
        .set("LegalCopyright", "Copyright (C) WordTap")
        .set("OriginalFilename", "wordtap-service.exe")
        .set("FileVersion", version)
        .set("ProductVersion", version);

    if let Err(error) = resource.compile() {
        panic!("failed to compile Windows resources: {error}");
    }
}

#[cfg(not(windows))]
fn main() {}
