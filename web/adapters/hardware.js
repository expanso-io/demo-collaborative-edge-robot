/**
 * Hardware adapter scaffold: supply a local transport with send(id, action, station)
 * and subscribe(id, callback). The transport owns authentication, safety interlocks,
 * coordinate conversion and real telemetry. No browser credentials or hardware calls
 * are provided here. Use connectAdapter from map.js to attach the same bus commands.
 */
export class HardwareAdapter {
  constructor(id, transport) { this.id = id; this.transport = transport; }
  moveTo(station) { return this.transport.send(this.id, 'move_to', station); }
  pause() { return this.transport.send(this.id, 'pause', null); }
  resume() { return this.transport.send(this.id, 'resume', null); }
  hold() { return this.transport.send(this.id, 'hold', null); }
  onState(callback) { return this.transport.subscribe(this.id, callback); }
}

export class RealRoverAdapter extends HardwareAdapter {
  constructor(transport) { super('rover-1', transport); }
}

export class RealDroneAdapter extends HardwareAdapter {
  constructor(id, transport) {
    if (!['drone-1', 'drone-2'].includes(id)) throw new RangeError('Unknown drone id');
    super(id, transport);
  }
}
