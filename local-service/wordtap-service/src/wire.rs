use std::error::Error;

#[derive(Default)]
pub(crate) struct ParsedMessage {
    pub(crate) headers: std::collections::HashMap<String, String>,
    pub(crate) data: Vec<u8>,
}

pub(crate) fn parse_text_message(message: &str) -> ParsedMessage {
    let Some((headers, data)) = message.split_once("\r\n\r\n") else {
        return ParsedMessage {
            data: message.as_bytes().to_vec(),
            ..ParsedMessage::default()
        };
    };

    ParsedMessage {
        headers: parse_headers(headers),
        data: data.as_bytes().to_vec(),
    }
}

pub(crate) fn parse_binary_message(
    bytes: &[u8],
) -> Result<ParsedMessage, Box<dyn Error + Send + Sync>> {
    if bytes.len() < 2 {
        return Err("Speech binary message is missing a header length.".into());
    }
    let header_length = u16::from_be_bytes([bytes[0], bytes[1]]) as usize;
    if bytes.len() < 2 + header_length {
        return Err("Speech binary message header is incomplete.".into());
    }

    let headers = parse_headers(std::str::from_utf8(&bytes[2..2 + header_length])?);
    let data = bytes[2 + header_length..].to_vec();
    Ok(ParsedMessage { headers, data })
}

fn parse_headers(text: &str) -> std::collections::HashMap<String, String> {
    text.split("\r\n")
        .filter_map(|line| {
            let (name, value) = line.split_once(':')?;
            Some((name.to_string(), value.to_string()))
        })
        .collect()
}
