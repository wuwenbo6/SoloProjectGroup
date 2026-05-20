export class Input {
  public thrust: number = 0;
  public turn: number = 0;
  public isMining: boolean = false;
  public isShooting: boolean = false;

  reset(): void {
    this.thrust = 0;
    this.turn = 0;
    this.isMining = false;
    this.isShooting = false;
  }

  clone(): Input {
    const input = new Input();
    input.thrust = this.thrust;
    input.turn = this.turn;
    input.isMining = this.isMining;
    input.isShooting = this.isShooting;
    return input;
  }
}
