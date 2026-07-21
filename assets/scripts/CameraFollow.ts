import { _decorator, Component, Node, Vec3, view } from "cc";

const { ccclass, property } = _decorator;

@ccclass("CameraFollow")
export class CameraFollow extends Component {
  @property(Node)
  target: Node | null = null;

  @property
  smooth = 8;

  @property
  mapWidth = 3600;

  @property
  mapHeight = 2400;

  private tempPosition = new Vec3();

  lateUpdate(deltaTime: number) {
    if (!this.target) {
      return;
    }

    const targetPosition = this.target.position;
    const desiredX = -targetPosition.x;
    const desiredY = -targetPosition.y;
    const limitedPosition = this.limitRootPosition(desiredX, desiredY);
    const currentPosition = this.node.position;
    const t = 1 - Math.exp(-this.smooth * deltaTime);

    Vec3.lerp(this.tempPosition, currentPosition, limitedPosition, t);
    this.node.setPosition(this.tempPosition);
  }

  private limitRootPosition(x: number, y: number) {
    const visibleSize = view.getVisibleSize();
    const halfViewWidth = visibleSize.width / 2;
    const halfViewHeight = visibleSize.height / 2;
    const halfMapWidth = this.mapWidth / 2;
    const halfMapHeight = this.mapHeight / 2;

    const limitedX =
      this.mapWidth <= visibleSize.width
        ? 0
        : Math.min(
            Math.max(x, halfViewWidth - halfMapWidth),
            halfMapWidth - halfViewWidth,
          );

    const limitedY =
      this.mapHeight <= visibleSize.height
        ? 0
        : Math.min(
            Math.max(y, halfViewHeight - halfMapHeight),
            halfMapHeight - halfViewHeight,
          );

    return new Vec3(limitedX, limitedY, 0);
  }
}
