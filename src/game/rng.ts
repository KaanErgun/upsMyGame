export class SeededRng {
  private state: number;

  constructor(seed: number) {
    this.state = seed | 0;
    if (this.state === 0) this.state = 1;
  }

  next(): number {
    this.state ^= this.state << 13;
    this.state ^= this.state >> 17;
    this.state ^= this.state << 5;
    return this.state;
  }

  nextFloat(): number {
    return (((this.next() >>> 0) % 10000) / 10000);
  }

  nextRange(min: number, max: number): number {
    return min + this.nextFloat() * (max - min);
  }

  getState(): number {
    return this.state;
  }
}
