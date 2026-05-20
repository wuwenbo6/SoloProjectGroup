use ancient_book_transcriber::{App, Result};

fn main() -> Result<()> {
    env_logger::init();
    
    let mut app = App::new()?;
    app.run()?;
    
    Ok(())
}
