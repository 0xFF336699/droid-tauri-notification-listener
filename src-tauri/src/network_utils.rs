use std::net::TcpListener;

/// 检查指定端口是否可用
pub fn check_port_available(port: u16) -> bool {
    TcpListener::bind(format!("127.0.0.1:{}", port)).is_ok()
}

/// 从指定端口开始查找可用端口
pub fn find_available_port(start_port: u16) -> Option<u16> {
    let end_port = start_port + 100; // 最多尝试100个端口

    for port in start_port..=end_port {
        if check_port_available(port) {
            return Some(port);
        }
    }

    None
}

/// 获取本机IP地址（优先IPv4）
pub fn get_local_ip() -> Result<String, String> {
    match local_ip_address::local_ip() {
        Ok(ip) => Ok(ip.to_string()),
        Err(e) => Err(format!("Failed to get local IP: {}", e))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_check_port_available() {
        // 端口 0 会让系统分配可用端口，所以这个测试应该通过
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let addr = listener.local_addr().unwrap();
        let port = addr.port();

        // 端口被占用
        assert!(!check_port_available(port));

        drop(listener);

        // 端口释放后应该可用
        assert!(check_port_available(port));
    }

    #[test]
    fn test_find_available_port() {
        let port = find_available_port(10035);
        assert!(port.is_some());
    }

    #[test]
    fn test_get_local_ip() {
        let ip = get_local_ip();
        assert!(ip.is_ok());
        println!("Local IP: {}", ip.unwrap());
    }
}
