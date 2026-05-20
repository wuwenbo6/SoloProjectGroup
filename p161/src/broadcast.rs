use crate::types::*;
use std::io::{Read, Write};
use std::net::{TcpListener, TcpStream, UdpSocket, SocketAddr};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use log::{info, error};

pub struct Broadcaster {
    config: BroadcastConfig,
    tcp_clients: Arc<Mutex<Vec<TcpStream>>>,
    udp_socket: Option<UdpSocket>,
}

impl Broadcaster {
    pub fn new(config: BroadcastConfig) -> Result<Self, Box<dyn std::error::Error>> {
        let tcp_clients = Arc::new(Mutex::new(Vec::new()));
        let udp_socket = match config.protocol {
            BroadcastProtocol::UDP => {
                let addr = format!("{}:{}", config.host, config.port);
                let socket = UdpSocket::bind("0.0.0.0:0")?;
                socket.set_broadcast(true)?;
                socket.connect(addr)?;
                Some(socket)
            }
            BroadcastProtocol::TCP => None,
        };

        Ok(Self {
            config,
            tcp_clients,
            udp_socket,
        })
    }

    pub fn start_tcp_server(&self) -> Result<(), Box<dyn std::error::Error>> {
        if self.config.protocol != BroadcastProtocol::TCP {
            return Ok(());
        }

        let addr = format!("{}:{}", self.config.host, self.config.port);
        let listener = TcpListener::bind(addr.clone())?;
        info!("TCP server listening on {}", addr);

        let clients = self.tcp_clients.clone();

        thread::spawn(move || {
            for stream in listener.incoming() {
                match stream {
                    Ok(stream) => {
                        info!("New TCP client connected: {}", stream.peer_addr().unwrap());
                        let mut clients_lock = clients.lock().unwrap();
                        clients_lock.push(stream);
                    }
                    Err(e) => {
                        error!("TCP connection error: {}", e);
                    }
                }
            }
        });

        Ok(())
    }

    pub fn broadcast(&self, data: &str) -> Result<(), Box<dyn std::error::Error>> {
        match self.config.protocol {
            BroadcastProtocol::TCP => self.broadcast_tcp(data),
            BroadcastProtocol::UDP => self.broadcast_udp(data),
        }
    }

    fn broadcast_tcp(&self, data: &str) -> Result<(), Box<dyn std::error::Error>> {
        let mut clients = self.tcp_clients.lock().unwrap();
        let mut to_remove = Vec::new();

        for (i, client) in clients.iter_mut().enumerate() {
            if let Err(e) = client.write_all(data.as_bytes()) {
                error!("Failed to write to TCP client: {}", e);
                to_remove.push(i);
            }
        }

        for &i in to_remove.iter().rev() {
            clients.remove(i);
        }

        Ok(())
    }

    fn broadcast_udp(&self, data: &str) -> Result<(), Box<dyn std::error::Error>> {
        if let Some(socket) = &self.udp_socket {
            socket.send(data.as_bytes())?;
        }
        Ok(())
    }
}

pub struct NmeaServer {
    broadcaster: Broadcaster,
    interval_ms: u64,
}

impl NmeaServer {
    pub fn new(config: BroadcastConfig, interval_ms: u64) -> Result<Self, Box<dyn std::error::Error>> {
        let mut broadcaster = Broadcaster::new(config)?;
        
        if let BroadcastProtocol::TCP = broadcaster.config.protocol {
            broadcaster.start_tcp_server()?;
        }

        Ok(Self {
            broadcaster,
            interval_ms,
        })
    }

    pub fn send_nmea(&self, nmea_sentences: &[String]) -> Result<(), Box<dyn std::error::Error>> {
        let data: String = nmea_sentences.concat();
        self.broadcaster.broadcast(&data)
    }

    pub fn get_interval(&self) -> Duration {
        Duration::from_millis(self.interval_ms)
    }
}
