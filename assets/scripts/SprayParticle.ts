import { _decorator, Component, Vec2 } from "cc";

const { ccclass, property } = _decorator;

@ccclass("SprayParticle")
export class SprayParticle extends Component {
  @property
  speed = 320;

  @property
  lifeTime = 0.45;

  private direction = new Vec2(0, 1);
  private age = 0;

  init(direction: Vec2) {
    this.direction.set(direction);

    if (this.direction.lengthSqr() > 0.001) {
      this.direction.normalize();
    }
  }

  update(deltaTime: number) {
    this.age += deltaTime;

    const pos = this.node.position;
    const nextX = pos.x + this.direction.x * this.speed * deltaTime;
    const nextY = pos.y + this.direction.y * this.speed * deltaTime;

    this.node.setPosition(nextX, nextY, pos.z);

    if (this.age >= this.lifeTime) {
      this.node.destroy();
    }
  }
}
