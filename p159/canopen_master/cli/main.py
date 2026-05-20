import click
import sys
import time
from typing import Optional

from canopen_master import CANopenMaster
from canopen_master.utils import get_logger, EDSParser
from canopen_master.core.nmt import NMTState


class CLISession:
    def __init__(self):
        self.master: Optional[CANopenMaster] = None
        self.logger = get_logger()
        self.eds_config = None

    def connect(self, interface: str, channel: str, bitrate: int):
        self.master = CANopenMaster(interface, channel, bitrate)
        self.master.connect()
        self.logger.info(f"Connected to CAN bus: {interface}:{channel} @ {bitrate} bps")
        
        def log_message(cob_id, data, timestamp):
            self.logger.log_can_message(cob_id, data, "RX")
        
        self.master.register_message_callback(log_message)

    def disconnect(self):
        if self.master:
            self.master.disconnect()
            self.logger.info("Disconnected from CAN bus")

    def load_eds(self, eds_file: str):
        parser = EDSParser()
        self.eds_config = parser.parse(eds_file)
        self.logger.info(f"Loaded EDS file: {eds_file}")
        self.logger.info(f"Device: {self.eds_config.device_name}")


pass_session = click.make_pass_decorator(CLISession, ensure=True)


@click.group(invoke_without_command=True)
@click.option('--interface', '-i', default='pcan', help='CAN interface (pcan, socketcan, virtual)')
@click.option('--channel', '-c', default='PCAN_USBBUS1', help='CAN channel')
@click.option('--bitrate', '-b', default=250000, type=int, help='CAN bitrate')
@click.option('--verbose', '-v', is_flag=True, help='Verbose output')
@click.option('--eds', '-e', 'eds_file', help='EDS file path')
@click.pass_context
def cli(ctx, interface, channel, bitrate, verbose, eds_file):
    """CANopen Master CLI Tool"""
    session = ctx.ensure_object(CLISession)
    
    if verbose:
        import logging
        session.logger.logger.setLevel(logging.DEBUG)
    
    session.connect(interface, channel, bitrate)
    
    if eds_file:
        session.load_eds(eds_file)
    
    ctx.call_on_close(session.disconnect)


@cli.command()
@click.argument('node_id', type=int)
@pass_session
def start(session, node_id):
    """Start a CANopen node"""
    session.master.start_node(node_id)
    session.logger.log_nmt(node_id, "START")
    click.echo(f"Node {node_id} started")


@cli.command()
@click.argument('node_id', type=int)
@pass_session
def stop(session, node_id):
    """Stop a CANopen node"""
    session.master.stop_node(node_id)
    session.logger.log_nmt(node_id, "STOP")
    click.echo(f"Node {node_id} stopped")


@cli.command()
@click.argument('node_id', type=int)
@pass_session
def reset(session, node_id):
    """Reset a CANopen node"""
    session.master.reset_node(node_id)
    session.logger.log_nmt(node_id, "RESET")
    click.echo(f"Node {node_id} reset")


@cli.command()
@click.argument('node_id', type=int)
@pass_session
def reset_comm(session, node_id):
    """Reset communication of a CANopen node"""
    session.master.reset_communication(node_id)
    session.logger.log_nmt(node_id, "RESET_COMM")
    click.echo(f"Node {node_id} communication reset")


@cli.command(name='start-all')
@pass_session
def start_all(session):
    """Start all CANopen nodes"""
    session.master.start_all_nodes()
    session.logger.log_nmt(0, "START_ALL")
    click.echo("All nodes started")


@cli.command(name='stop-all')
@pass_session
def stop_all(session):
    """Stop all CANopen nodes"""
    session.master.stop_all_nodes()
    session.logger.log_nmt(0, "STOP_ALL")
    click.echo("All nodes stopped")


@cli.command()
@click.argument('node_id', type=int)
@pass_session
def state(session, node_id):
    """Get NMT state of a node"""
    node_state = session.master.get_node_state(node_id)
    if node_state:
        click.echo(f"Node {node_id} state: {node_state.name}")
    else:
        click.echo(f"Node {node_id} state: Unknown")


@cli.command(name='list-nodes')
@pass_session
def list_nodes(session):
    """List all detected nodes"""
    states = session.master.get_all_node_states()
    if states:
        click.echo("Detected nodes:")
        for node_id, node_state in states.items():
            click.echo(f"  Node {node_id}: {node_state.state.name}")
    else:
        click.echo("No nodes detected")


@cli.command(name='sdo-read')
@click.argument('node_id', type=int)
@click.argument('index', type=str)
@click.argument('subindex', type=int, default=0)
@click.option('--type', '-t', 'data_type', default='raw', 
              type=click.Choice(['raw', 'u8', 'u16', 'u32', 's8', 's16', 's32', 'float', 'string']))
@pass_session
def sdo_read(session, node_id, index, subindex, data_type):
    """Read object via SDO"""
    try:
        index_int = int(index, 16) if index.startswith('0x') or index.startswith('0X') else int(index)
    except ValueError:
        click.echo(f"Invalid index: {index}")
        return

    try:
        import struct
        data = session.master.sdo_read(node_id, index_int, subindex)
        session.logger.log_sdo(node_id, index_int, subindex, "READ", data)

        if data_type == 'raw':
            hex_data = ' '.join(f'{b:02X}' for b in data)
            click.echo(f"Data: [{len(data)} bytes] {hex_data}")
        elif data_type == 'u8':
            click.echo(f"Value: {struct.unpack('<B', data)[0]}")
        elif data_type == 'u16':
            click.echo(f"Value: {struct.unpack('<H', data)[0]}")
        elif data_type == 'u32':
            click.echo(f"Value: {struct.unpack('<I', data)[0]}")
        elif data_type == 's8':
            click.echo(f"Value: {struct.unpack('<b', data)[0]}")
        elif data_type == 's16':
            click.echo(f"Value: {struct.unpack('<h', data)[0]}")
        elif data_type == 's32':
            click.echo(f"Value: {struct.unpack('<i', data)[0]}")
        elif data_type == 'float':
            click.echo(f"Value: {struct.unpack('<f', data)[0]}")
        elif data_type == 'string':
            decoded = data.rstrip(b'\x00').decode('ascii', errors='replace')
            click.echo(f"Value: {decoded}")
    except Exception as e:
        click.echo(f"SDO read failed: {e}", err=True)
        sys.exit(1)


@cli.command(name='sdo-write')
@click.argument('node_id', type=int)
@click.argument('index', type=str)
@click.argument('subindex', type=int)
@click.argument('value', type=str)
@click.option('--type', '-t', 'data_type', default='raw',
              type=click.Choice(['raw', 'u8', 'u16', 'u32', 's8', 's16', 's32', 'float', 'string']))
@pass_session
def sdo_write(session, node_id, index, subindex, value, data_type):
    """Write object via SDO"""
    try:
        index_int = int(index, 16) if index.startswith('0x') or index.startswith('0X') else int(index)
    except ValueError:
        click.echo(f"Invalid index: {index}")
        return

    try:
        import struct
        if data_type == 'raw':
            data = bytes.fromhex(value.replace(' ', ''))
        elif data_type == 'u8':
            data = struct.pack('<B', int(value))
        elif data_type == 'u16':
            data = struct.pack('<H', int(value))
        elif data_type == 'u32':
            data = struct.pack('<I', int(value))
        elif data_type == 's8':
            data = struct.pack('<b', int(value))
        elif data_type == 's16':
            data = struct.pack('<h', int(value))
        elif data_type == 's32':
            data = struct.pack('<i', int(value))
        elif data_type == 'float':
            data = struct.pack('<f', float(value))
        elif data_type == 'string':
            data = value.encode('ascii') + b'\x00'

        session.master.sdo_write(node_id, index_int, subindex, data)
        session.logger.log_sdo(node_id, index_int, subindex, "WRITE", data)
        click.echo("Write successful")
    except Exception as e:
        click.echo(f"SDO write failed: {e}", err=True)
        sys.exit(1)


@cli.command(name='heartbeat-start')
@click.option('--producer-id', '-p', default=0, type=int, help='Heartbeat producer ID')
@click.option('--interval', '-i', default=1000, type=int, help='Heartbeat interval in ms')
@pass_session
def heartbeat_start(session, producer_id, interval):
    """Start heartbeat producer"""
    session.master.start_heartbeat_producer(producer_id, interval)
    session.logger.info(f"Heartbeat producer started (ID: {producer_id}, interval: {interval}ms")
    click.echo(f"Heartbeat producer started")


@cli.command(name='heartbeat-stop')
@pass_session
def heartbeat_stop(session):
    """Stop heartbeat producer"""
    session.master.stop_heartbeat_producer()
    session.logger.info("Heartbeat producer stopped")
    click.echo("Heartbeat producer stopped")


@cli.command()
@pass_session
def sync(session):
    """Send SYNC message"""
    session.master.send_sync()
    session.logger.debug("SYNC message sent")
    click.echo("SYNC message sent")


@cli.command()
@click.option('--timeout', '-t', default=2.0, type=float, help='Scan timeout in seconds')
@pass_session
def scan(session, timeout):
    """Scan for CANopen nodes"""
    click.echo(f"Scanning for nodes (timeout: {timeout}s)...")
    nodes = session.master.scan_nodes(timeout)
    if nodes:
        click.echo(f"Found {len(nodes)} node(s):")
        for node_id in sorted(nodes):
            state = session.master.get_node_state(node_id)
            state_name = state.name if state else "Unknown"
            click.echo(f"  Node {node_id}: {state_name}")
    else:
        click.echo("No nodes found")


@cli.command(name='monitor')
@click.option('--duration', '-d', type=float, help='Monitoring duration in seconds')
@pass_session
def monitor(session, duration):
    """Monitor CAN bus traffic"""
    click.echo("Monitoring CAN bus... (press Ctrl+C to stop)")
    if duration:
        click.echo(f"Duration: {duration} seconds")
    
    try:
        if duration:
            time.sleep(duration)
        else:
            while True:
                time.sleep(1)
    except KeyboardInterrupt:
        pass
    finally:
        click.echo("Monitoring stopped")


@cli.command(name='load-eds')
@click.argument('eds_file', type=click.Path(exists=True))
@pass_session
def load_eds(session, eds_file):
    """Load EDS file"""
    session.load_eds(eds_file)
    click.echo(f"Loaded EDS: {session.eds_config.device_name}")
    click.echo(f"  Vendor ID: 0x{session.eds_config.vendor_id:08X}")
    click.echo(f"  Product Code: 0x{session.eds_config.product_code:08X}")
    click.echo(f"  Objects: {len(session.eds_config.objects)}")


@cli.command(name='list-objects')
@click.option('--index', '-i', help='Filter by index (hex)')
@pass_session
def list_objects(session, index):
    """List objects from EDS"""
    if not session.eds_config:
        click.echo("No EDS file loaded")
        return

    if index:
        try:
            index_int = int(index, 16) if index.startswith('0x') or index.startswith('0X') else int(index)
        except ValueError:
            click.echo(f"Invalid index: {index}")
            return

    objects = []
    for obj in session.eds_config.objects.values():
        if index and obj.index != index_int:
            continue
        objects.append(obj)

    if objects:
        click.echo("Object Dictionary:")
        for obj in sorted(objects, key=lambda o: (o.index, o.subindex)):
            click.echo(f"  0x{obj.index:04X}:{obj.subindex:02X} - {obj.name} ({obj.data_type}) [{obj.access}]")
    else:
        click.echo("No matching objects found")


@cli.command(name='pdo-list')
@click.option('--type', '-t', 'pdo_type', default='all',
              type=click.Choice(['all', 'rpdo', 'tpdo']))
@pass_session
def pdo_list(session, pdo_type):
    """List configured PDOs"""
    if pdo_type in ['all', 'tpdo']:
        tpdos = session.master.pdo.get_all_tpdos()
        if tpdos:
            click.echo("TPDOs:")
            for cob_id, pdo in sorted(tpdos.items()):
                click.echo(f"  0x{cob_id:03X} - {'Enabled' if pdo.enabled else 'Disabled'}")
                for mapping in pdo.mappings:
                    click.echo(f"    0x{mapping.index:04X}:{mapping.subindex:02X} ({mapping.bit_length} bits)")

    if pdo_type in ['all', 'rpdo']:
        rpdos = session.master.pdo.get_all_rpdos()
        if rpdos:
            click.echo("RPDOs:")
            for cob_id, pdo in sorted(rpdos.items()):
                click.echo(f"  0x{cob_id:03X} - {'Enabled' if pdo.enabled else 'Disabled'}")
                for mapping in pdo.mappings:
                    click.echo(f"    0x{mapping.index:04X}:{mapping.subindex:02X} ({mapping.bit_length} bits)")


if __name__ == '__main__':
    cli()
