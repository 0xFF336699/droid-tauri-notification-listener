use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpStream;

#[tokio::main]
async fn main() {
    println!("[TestClient] Starting test client...");

    // 等待 7 秒让服务器启动
    println!("[TestClient] Waiting 7 seconds for server to start...");
    tokio::time::sleep(tokio::time::Duration::from_secs(7)).await;

    println!("[TestClient] Connecting to 127.0.0.1:10035...");
    match TcpStream::connect("127.0.0.1:10035").await {
        Ok(mut stream) => {
            println!("[TestClient] Connected successfully!");

            // 发送测试数据
            let test_data = r#"{"url":"192.168.177.180:10035","token":"test_token_12345"}"#;
            println!("[TestClient] Sending: {}", test_data);

            let (reader, mut writer) = stream.split();
            let mut reader = BufReader::new(reader);

            writer.write_all(format!("{}\n", test_data).as_bytes()).await.unwrap();
            writer.flush().await.unwrap();
            println!("[TestClient] Data sent, waiting for response...");

            // 读取响应
            let mut response = String::new();
            match reader.read_line(&mut response).await {
                Ok(n) => {
                    if n > 0 {
                        println!("[TestClient] Received response: {}", response.trim());
                    } else {
                        println!("[TestClient] Connection closed by server");
                    }
                }
                Err(e) => {
                    eprintln!("[TestClient] Failed to read response: {}", e);
                }
            }
        }
        Err(e) => {
            eprintln!("[TestClient] Failed to connect: {}", e);
        }
    }

    println!("[TestClient] Test completed");
}
