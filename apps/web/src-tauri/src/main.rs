// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use reqwest::{Client, header};
use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize, Debug)]
struct TrackerResponse {
    success: bool,
    data: Option<serde_json::Value>,
    error: Option<String>,
}

/// A highly optimized IPC command to fetch data from Torrentio/Debrid APIs
/// bypassing browser CORS and Cloudflare limits by acting as a native client.
#[tauri::command]
async fn scrape_external_tracker(url: String, user_agent: String) -> Result<String, String> {
    
    let mut headers = header::HeaderMap::new();
    headers.insert(
        header::USER_AGENT,
        header::HeaderValue::from_str(&user_agent).map_err(|e| e.to_string())?,
    );
    headers.insert(
        header::ACCEPT,
        header::HeaderValue::from_static("application/json, text/plain, */*"),
    );

    // Build the reqwest client. In a real scenario, this would be a shared AppState
    let client = Client::builder()
        .default_headers(headers)
        .use_rustls_tls() // better than native-tls for cross-platform size/perf
        .build()
        .map_err(|e| e.to_string())?;

    let res = client.get(&url).send().await.map_err(|e| e.to_string())?;
    
    // Check if the request was successful
    if res.status().is_client_error() || res.status().is_server_error() {
       return Err(format!("Request failed with status: {}", res.status()));
    }

    let body = res.text().await.map_err(|e| e.to_string())?;

    // Return the raw text, letting the React Wasm frontend parse the JSON
    Ok(body)
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![scrape_external_tracker])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
