import {
  _decorator,
  Component,
  Node,
  UITransform,
  Vec2,
  Vec3,
  Sprite,
  Color,
  director,
  Graphics,
} from "cc";

import { PlayerController } from "./PlayerController";

const { ccclass, property } = _decorator;

export enum EnemyMode {
  Drift,
  Chase,
  NativeChase,
}

export enum EnemyActivity {
  Sluggish,
  ActiveGrower,
}

@ccclass("EnemyController")
export class EnemyController extends Component {
  @property
  mass = 260;

  @property
  moveSpeed = 45;

  @property
  sizeScale = 4;

  @property
  minSize = 36;

  @property
  mapWidth = 2400;

  @property
  mapHeight = 1600;

  @property
  eatRatio = 1.03;

  @property
  collisionRadiusScale = 0.88;

  @property
  rewardMass = 70;

  @property
  absorbSpeed = 18;

  @property
  escapeImpulse = 28;

  @property
  playerPressureEscapeBoost = 3.2;

  @property
  absorbedEscapeSpeed = 180;

  @property
  absorbedEscapeTurnSpeed = 8;

  @property
  escapeStartLossRatio = 0.68;

  @property
  escapeStopDistance = 320;

  @property
  visualEscapePadding = 28;

  @property
  escapeMaxSpeedMultiplier = 2.4;

  @property
  alertDuration = 4;

  @property
  alertAvoidRadius = 145;

  @property
  alertAvoidTurnSpeed = 5;

  @property
  killMass = 20;

  @property
  mode = EnemyMode.Drift;

  @property
  activity = EnemyActivity.Sluggish;

  @property
  canForage = true;

  @property
  foodMass = 10;

  @property
  bonusFoodMass = 18;

  @property
  foodSenseRange = 240;

  @property
  activeFoodSenseRange = 460;

  @property
  foodSteerSpeed = 2.2;

  @property
  passiveEnemyAbsorbMultiplier = 0.75;

  @property
  chaseRange = 260;

  @property
  chaseTurnSpeed = 2.5;

  @property
  chaseGiveUpTime = 8;

  @property
  chaseStopPlayerMassRatio = 1;

  @property
  nativeChaseFarDistance = 900;

  @property
  nativeChaseCloseDistance = 220;

  @property
  nativeChaseFarSpeedMultiplier = 1.35;

  @property
  nativeChaseCloseSpeedMultiplier = 0.72;

  private direction = new Vec2();
  private baseMoveSpeed = 45;
  private configuredBaseMoveSpeed = 0;
  private startMass = 260;
  private player: Node | null = null;
  private foodRoot: Node | null = null;
  private enemyRoot: Node | null = null;
  private isChasing = false;
  private chaseTimer = 0;
  private hasLostInterest = false;
  private isEscapingFromPlayer = false;
  private alertTimer = 0;
  private playerAlertTimer = 0;
  private escapeLockTimer = 0;
  private zoneIntentTimer = 0;
  private stageEscapeBoostTimer = 0;
  private stageEscapeBoostPower = 0;
  private growthPulseTimer = 0;
  private damagePulseTimer = 0;
  private pulseDuration = 0.26;
  private growthPulseStrength = 0;
  private damagePulseStrength = 0;
  private wasEatenByEnemyTimer = 0;
  private enemyEaterPosition = new Vec3();
  private enemyEaterEscapeStopDistance = 0;
  private hasEnemyEaterPosition = false;
  private playerEscapePower = 0.55;
  private hasPlayerEscapePower = false;
  private triggeredEscapeStage = 0;
  private traitMark: Graphics | null = null;
  private damageOverlay: Graphics | null = null;
  private relationRing: Graphics | null = null;
  private stateMarker: Graphics | null = null;

  start() {
    const angle = Math.random() * Math.PI * 2;

    this.direction.set(Math.cos(angle), Math.sin(angle));
    this.baseMoveSpeed = this.configuredBaseMoveSpeed > 0
      ? this.configuredBaseMoveSpeed
      : this.moveSpeed;
    this.startMass = this.mass;
    this.player = director
      .getScene()
      ?.getChildByName("Canvas")
      ?.getChildByName("GameRoot")
      ?.getChildByName("Player") ?? null;
    this.foodRoot = director
      .getScene()
      ?.getChildByName("Canvas")
      ?.getChildByName("GameRoot")
      ?.getChildByName("FoodRoot") ?? null;
    this.enemyRoot = this.node.parent ?? director
      .getScene()
      ?.getChildByName("Canvas")
      ?.getChildByName("GameRoot")
      ?.getChildByName("EnemyRoot") ?? null;
    this.createRelationRing();
    this.createTraitMark();
    this.createDamageOverlay();
    this.createStateMarker();
    this.updateSize();
  }

  refreshSize() {
    this.configuredBaseMoveSpeed = this.moveSpeed;
    this.baseMoveSpeed = this.moveSpeed;
    this.updateSize();
    this.applyVisual();
  }

  update(deltaTime: number) {
    if (this.isGameActionPaused()) {
      return;
    }

    this.updateTimers(deltaTime);
    this.updateDirection(deltaTime);
    this.updateEcologyDirection(deltaTime);
    this.move(deltaTime);
    this.checkEatFood();
    this.updateRelationRing();
    this.updateTraitMark();
    this.updateDamageOverlay();
    this.updateStateMarker();
    this.checkPlayerCollision(deltaTime);
    this.checkEnemyCollision(deltaTime);
    this.updateVisualPulse(deltaTime);
  }

  private applyVisual() {
    const sprite = this.node.getComponent(Sprite);

    if (!sprite) {
      return;
    }

    let color: Color;

    if (this.activity === EnemyActivity.ActiveGrower && this.mass < 900) {
      color = new Color(70, 205, 190, 255);
    } else if (this.mass < 150) {
      color = new Color(90, 185, 130, 255);
    } else if (this.mass < 900) {
      color = new Color(80, 140, 210, 255);
    } else {
      color = new Color(160, 65, 65, 255);
    }

    sprite.color = color;
  }

  private createRelationRing() {
    const ringNode = new Node("RelationRing");

    ringNode.setParent(this.node);
    ringNode.setPosition(0, 0, 0);
    ringNode.addComponent(UITransform);
    this.relationRing = ringNode.addComponent(Graphics);
  }

  private createTraitMark() {
    const markNode = new Node("TraitMark");

    markNode.setParent(this.node);
    markNode.setPosition(0, 0, 0);
    markNode.addComponent(UITransform);
    this.traitMark = markNode.addComponent(Graphics);
  }

  private createDamageOverlay() {
    const overlayNode = new Node("DamageOverlay");

    overlayNode.setParent(this.node);
    overlayNode.setPosition(0, 0, 0);
    overlayNode.setSiblingIndex(99);
    overlayNode.addComponent(UITransform);
    this.damageOverlay = overlayNode.addComponent(Graphics);
  }

  private createStateMarker() {
    const markerNode = new Node("StateMarker");

    markerNode.setParent(this.node);
    markerNode.setPosition(0, 0, 0);
    markerNode.addComponent(UITransform);
    this.stateMarker = markerNode.addComponent(Graphics);
    markerNode.active = false;
  }

  private updateRelationRing() {
    if (!this.relationRing || !this.player?.isValid) {
      return;
    }

    const playerController = this.player.getComponent(PlayerController);
    const playerMass = playerController?.getMass() ?? 0;
    const distance = Vec3.distance(this.node.position, this.player.position);
    const touchDistance = this.getRadius() + this.getNodeRadius(this.player);

    this.relationRing.clear();

    if (this.activity === EnemyActivity.ActiveGrower) {
      this.relationRing.lineWidth = 2;
      this.relationRing.strokeColor = new Color(70, 230, 220, 44);
      this.relationRing.circle(0, 0, this.getRadius() + 1);
      this.relationRing.stroke();
    }

    if (this.isEscapingFromPlayer) {
      this.relationRing.lineWidth = 2;
      this.relationRing.strokeColor = new Color(255, 165, 45, this.playerAlertTimer > 0 ? 92 : 40);
      this.relationRing.circle(0, 0, this.getRadius() + 2);
      this.relationRing.stroke();
    }

    if (this.wasEatenByEnemyTimer > 0 && this.hasEnemyEaterPosition) {
      this.relationRing.lineWidth = 2;
      this.relationRing.strokeColor = new Color(255, 180, 80, 34);
      this.relationRing.circle(0, 0, this.getRadius() + 1);
      this.relationRing.stroke();
    }

    if (distance > touchDistance + 90) {
      return;
    }

    if (playerMass >= this.mass * this.eatRatio) {
      this.relationRing.strokeColor = new Color(70, 230, 130, 120);
    } else if (this.mass >= playerMass * this.eatRatio) {
      this.relationRing.strokeColor = new Color(255, 60, 60, 130);
    } else {
      this.relationRing.strokeColor = new Color(255, 210, 70, 115);
    }

    this.relationRing.lineWidth = 2;
    this.relationRing.circle(0, 0, this.getRadius() + 3);
    this.relationRing.stroke();
  }

  private updateTraitMark() {
    if (!this.traitMark) {
      return;
    }

    const radius = this.getRadius();

    this.traitMark.clear();

    if (radius < 14) {
      return;
    }

    if (this.mass >= 900) {
      this.traitMark.lineWidth = Math.max(2, radius * 0.035);
      this.traitMark.strokeColor = new Color(245, 225, 190, 58);
      this.traitMark.circle(0, 0, radius * 0.54);
      this.traitMark.stroke();
      this.traitMark.lineWidth = Math.max(2, radius * 0.025);
      this.traitMark.strokeColor = new Color(45, 20, 20, 72);
      this.traitMark.circle(0, 0, radius * 0.32);
      this.traitMark.stroke();
    }

    if (this.activity === EnemyActivity.ActiveGrower && this.mass < 900) {
      this.drawGrowerTrait(radius);
      return;
    }

    if (this.mode === EnemyMode.Chase || this.mode === EnemyMode.NativeChase) {
      this.drawHunterTrait(radius);
    }
  }

  private drawGrowerTrait(radius: number) {
    if (!this.traitMark) {
      return;
    }

    const length = radius * 0.58;
    const gap = radius * 0.18;

    this.traitMark.lineWidth = Math.max(3, radius * 0.045);
    this.traitMark.strokeColor = new Color(185, 255, 245, 145);

    for (let i = -1; i <= 1; i++) {
      const y = i * gap;

      this.traitMark.moveTo(-length * 0.45, y - gap * 0.45);
      this.traitMark.lineTo(0, y);
      this.traitMark.lineTo(length * 0.45, y - gap * 0.45);
    }

    this.traitMark.stroke();
    this.traitMark.fillColor = new Color(205, 255, 245, 72);
    this.traitMark.circle(0, 0, radius * 0.18);
    this.traitMark.fill();
  }

  private drawHunterTrait(radius: number) {
    if (!this.traitMark) {
      return;
    }

    this.traitMark.lineWidth = Math.max(3, radius * 0.045);
    this.traitMark.strokeColor = new Color(255, 95, 75, 150);
    this.traitMark.moveTo(-radius * 0.38, radius * 0.2);
    this.traitMark.lineTo(0, -radius * 0.16);
    this.traitMark.lineTo(radius * 0.38, radius * 0.2);
    this.traitMark.stroke();
    this.traitMark.fillColor = new Color(255, 80, 60, 86);
    this.traitMark.circle(0, radius * 0.12, radius * 0.13);
    this.traitMark.fill();
  }

  private updateStateMarker() {
    if (!this.stateMarker) {
      return;
    }

    const radius = this.getRadius();

    this.stateMarker.node.setPosition(radius * 0.55, radius * 0.55, 0);
    this.stateMarker.clear();

    if (this.playerAlertTimer > 0) {
      this.stateMarker.node.active = true;
      this.drawExclamationMarker(new Color(255, 180, 45, 240));
      return;
    }

    if (this.isChasing) {
      this.stateMarker.node.active = true;
      this.drawExclamationMarker(new Color(255, 55, 55, 245));
      return;
    }

    this.stateMarker.node.active = false;
  }

  private drawExclamationMarker(color: Color) {
    if (!this.stateMarker) {
      return;
    }

    this.stateMarker.fillColor = color;
    this.stateMarker.circle(0, 0, 11);
    this.stateMarker.fill();
    this.stateMarker.fillColor = new Color(40, 25, 15, 255);
    this.stateMarker.rect(-1.6, -4, 3.2, 10);
    this.stateMarker.circle(0, -7.5, 1.8);
    this.stateMarker.fill();
  }

  private drawActiveGrowerMarker() {
    if (!this.stateMarker) {
      return;
    }

    this.stateMarker.fillColor = new Color(50, 235, 220, 235);
    this.stateMarker.moveTo(0, 10);
    this.stateMarker.lineTo(9, -5);
    this.stateMarker.lineTo(2, -2);
    this.stateMarker.lineTo(0, -10);
    this.stateMarker.lineTo(-2, -2);
    this.stateMarker.lineTo(-9, -5);
    this.stateMarker.close();
    this.stateMarker.fill();
    this.stateMarker.fillColor = new Color(215, 255, 250, 230);
    this.stateMarker.circle(0, 0, 2.6);
    this.stateMarker.fill();
  }

  private updateDirection(deltaTime: number) {
    if (this.wasEatenByEnemyTimer > 0 && this.hasEnemyEaterPosition) {
      this.isChasing = false;

      if (this.isTooWeakToEscape()) {
        this.moveSpeed = this.baseMoveSpeed * 0.42;
        this.applyVisual();
        return;
      }

      this.steerAwayFromPoint(
        this.enemyEaterPosition,
        this.absorbedEscapeTurnSpeed * 0.85,
        deltaTime,
      );
      this.applyVisual();
      return;
    }

    if (this.mode !== EnemyMode.Chase && this.mode !== EnemyMode.NativeChase) {
      this.isChasing = false;
      this.applyVisual();
      return;
    }

    if (!this.player?.isValid) {
      this.isChasing = false;
      this.applyVisual();
      return;
    }

    const toPlayer = new Vec2(
      this.player.position.x - this.node.position.x,
      this.player.position.y - this.node.position.y,
    );
    const distanceToPlayer = toPlayer.length();
    const playerController = this.player.getComponent(PlayerController);
    const playerMass = playerController?.getMass() ?? 0;

    if (this.isEscapingFromPlayer || this.escapeLockTimer > 0) {
      this.isChasing = false;
      this.updatePlayerEscapeMotion(deltaTime, 0.18);
      this.applyVisual();
      return;
    }

    if (playerMass >= this.mass) {
      this.fleeFromBiggerPlayer(deltaTime, playerMass >= this.mass * this.eatRatio ? 0.8 : 0.45);
      return;
    }

    if (this.mode === EnemyMode.Chase) {
      if (playerMass >= this.mass * this.chaseStopPlayerMassRatio) {
        this.fleeFromBiggerPlayer(deltaTime, 0.45);
        return;
      }

      if (this.hasLostInterest) {
        this.applyVisual();
        return;
      }

      if (!this.isChasing && distanceToPlayer > this.chaseRange) {
        this.applyVisual();
        return;
      }

      this.isChasing = true;
      this.chaseTimer += deltaTime;

      if (
        this.chaseTimer >= this.chaseGiveUpTime ||
        distanceToPlayer > this.chaseRange * 1.45
      ) {
        this.loseInterest();
        return;
      }
    }

    this.updateChaseSpeed(distanceToPlayer);

    if (toPlayer.lengthSqr() > 0.001) {
      this.isChasing = true;
      this.applyVisual();
      toPlayer.normalize();
      this.direction.x += (toPlayer.x - this.direction.x) * this.chaseTurnSpeed * deltaTime;
      this.direction.y += (toPlayer.y - this.direction.y) * this.chaseTurnSpeed * deltaTime;
      if (this.direction.lengthSqr() > 0.001) {
        this.direction.normalize();
      }
    }
  }

  private loseInterest() {
    this.hasLostInterest = true;
    this.isChasing = false;
    this.moveSpeed = this.baseMoveSpeed;
    this.applyVisual();
  }

  private fleeFromBiggerPlayer(deltaTime: number, urgency: number) {
    this.hasLostInterest = true;
    this.isChasing = false;
    this.isEscapingFromPlayer = true;
    this.escapeLockTimer = Math.max(this.escapeLockTimer, 2.2);
    this.alertTimer = Math.max(this.alertTimer, this.alertDuration);
    this.playerAlertTimer = Math.max(this.playerAlertTimer, 1.8);
    this.moveSpeed = Math.max(
      this.moveSpeed,
      this.baseMoveSpeed * (1.08 + urgency * 0.55),
    );
    this.steerAwayFromPlayer(deltaTime, this.alertAvoidTurnSpeed * (1.25 + urgency));
    this.applyVisual();
  }

  private updateChaseSpeed(distance: number) {
    if (this.mode !== EnemyMode.NativeChase) {
      this.moveSpeed = this.baseMoveSpeed;
      return;
    }

    if (distance <= this.nativeChaseCloseDistance) {
      this.moveSpeed = this.baseMoveSpeed * this.nativeChaseCloseSpeedMultiplier;
      return;
    }

    if (distance >= this.nativeChaseFarDistance) {
      this.moveSpeed = this.baseMoveSpeed * this.nativeChaseFarSpeedMultiplier;
      return;
    }

    this.moveSpeed = this.baseMoveSpeed;
  }

  private move(deltaTime: number) {
    const pos = this.node.position;
    let nextX = pos.x + this.direction.x * this.moveSpeed * deltaTime;
    let nextY = pos.y + this.direction.y * this.moveSpeed * deltaTime;
    const radius = this.getRadius();
    const minX = -this.mapWidth / 2 + radius;
    const maxX = this.mapWidth / 2 - radius;
    const minY = -this.mapHeight / 2 + radius;
    const maxY = this.mapHeight / 2 - radius;

    if (nextX < minX || nextX > maxX) {
      this.direction.x *= -1;
      nextX = Math.min(Math.max(nextX, minX), maxX);
    }

    if (nextY < minY || nextY > maxY) {
      this.direction.y *= -1;
      nextY = Math.min(Math.max(nextY, minY), maxY);
    }

    this.node.setPosition(nextX, nextY, pos.z);
  }

  private checkPlayerCollision(deltaTime: number) {
    if (!this.player?.isValid) {
      return;
    }

    const playerController = this.player.getComponent(PlayerController);
    const playerMass = playerController?.getMass() ?? 0;
    const distance = Vec3.distance(this.node.position, this.player.position);
    const touchDistance =
      this.getCollisionRadius(this.node) +
      this.getCollisionRadius(this.player) +
      (playerController?.getSwallowRadiusBonus?.() ?? 0);

    if (distance > touchDistance) {
      return;
    }

    const overlapRate = Math.min((touchDistance - distance) / touchDistance, 1);
    const fromEnemyToPlayer = new Vec2(
      this.player.position.x - this.node.position.x,
      this.player.position.y - this.node.position.y,
    );

    if (playerMass >= this.mass * this.eatRatio) {
      const damage = Math.min(
        this.mass - this.killMass,
        this.getPlayerAbsorbDamage(overlapRate, deltaTime) *
          (playerController?.getAbsorbDamageMultiplier() ?? 1),
      );

      this.mass -= damage;
      this.triggerDamagePulse(damage);
      playerController?.addMass(damage);
      this.updateSize();
      this.tryTriggerStageEscape(overlapRate);

      if (this.mass <= this.killMass) {
        playerController?.addMassWithFeedback(
          this.getKillRewardMass() * (playerController?.getKillRewardMultiplier() ?? 1),
          this.node.position.clone(),
          this.startMass >= 900 ? 1.6 : this.startMass >= 150 ? 1.25 : 1,
        );
        this.node.destroy();
        return;
      }

      if (this.shouldEscapeFromPlayer()) {
        this.escapeFromPlayer(deltaTime, overlapRate);
      } else {
        this.sluggishResistPlayer(deltaTime, overlapRate);
      }

      return;
    }

    if (this.mass >= playerMass * this.eatRatio) {
      const damage =
        this.absorbSpeed *
        overlapRate *
        deltaTime *
        (playerController?.getPressureDamageMultiplier() ?? 1);

      playerController?.loseMass(damage, overlapRate);
      playerController?.addImpulse(
        fromEnemyToPlayer,
        this.escapeImpulse * 0.18 * Math.max(0.2, overlapRate),
      );

      if ((playerController?.getMass() ?? 0) <= this.killMass) {
        this.endGame();
      }

      return;
    }

    if (overlapRate > 0.05) {
      playerController?.addImpulse(fromEnemyToPlayer, this.escapeImpulse * 0.4 * overlapRate);
    }
  }

  private escapeFromPlayer(deltaTime: number, overlapRate: number) {
    if (!this.player?.isValid) {
      return;
    }

    this.isEscapingFromPlayer = true;
    this.refreshPressureEscapeBoost(overlapRate);
    this.updatePlayerEscapeMotion(deltaTime, overlapRate);
  }

  private updatePlayerEscapeMotion(deltaTime: number, overlapRate: number) {
    if (!this.player?.isValid || this.isTooWeakToEscape()) {
      return;
    }

    const away = this.getAwayFromPlayer();

    if (away.lengthSqr() <= 0.001) {
      return;
    }

    const targetSpeed = this.getPlayerEscapeTargetSpeed(overlapRate);
    const acceleration = this.getPlayerEscapeAcceleration(overlapRate);
    const speedBlend = Math.min(1, acceleration * deltaTime);
    const turnBlend = Math.min(1, this.absorbedEscapeTurnSpeed * (1.05 + overlapRate) * deltaTime);

    this.isEscapingFromPlayer = true;
    this.alertTimer = this.alertDuration;
    this.playerAlertTimer = Math.max(this.playerAlertTimer, 1.6);
    this.escapeLockTimer = Math.max(this.escapeLockTimer, 1.4);
    this.moveSpeed += (targetSpeed - this.moveSpeed) * speedBlend;
    this.direction.x += (away.x - this.direction.x) * turnBlend;
    this.direction.y += (away.y - this.direction.y) * turnBlend;

    if (this.direction.lengthSqr() > 0.001) {
      this.direction.normalize();
    }
  }

  private getPlayerEscapeTargetSpeed(overlapRate: number) {
    const mobility = this.getEscapeMobility();
    const escapePower = this.getPlayerEscapePower();
    const playerScaleBoost = this.getPlayerScaleEscapeBoost();
    const stageBoost = this.getStageEscapeSpeedBoost();
    const pressure = 0.72 + Math.max(0, overlapRate) * 0.75;
    const baseTarget =
      this.baseMoveSpeed *
      (0.85 + this.escapeMaxSpeedMultiplier * mobility) *
      escapePower *
      playerScaleBoost *
      stageBoost;
    const absorbedTarget =
      this.absorbedEscapeSpeed *
      (0.16 + 0.68 * mobility) *
      escapePower *
      playerScaleBoost *
      stageBoost *
      pressure;

    return Math.min(Math.max(baseTarget, absorbedTarget), this.getEscapeSpeedCap());
  }

  private getPlayerEscapeAcceleration(overlapRate: number) {
    const typeBoost =
      this.activity === EnemyActivity.ActiveGrower
        ? 4.7
        : this.mode === EnemyMode.Chase || this.mode === EnemyMode.NativeChase
          ? 3.45
          : this.startMass >= 900
            ? 2.55
            : 0.8;
    const stageBoost = this.stageEscapeBoostTimer > 0 ? 3.1 : 0;

    return 4.2 + overlapRate * 5.4 + typeBoost + stageBoost;
  }

  private sluggishResistPlayer(deltaTime: number, overlapRate: number) {
    if (this.activity === EnemyActivity.ActiveGrower && !this.isTooWeakToEscape()) {
      this.escapeFromPlayer(deltaTime, overlapRate);
      return;
    }

    if (this.isTooWeakToEscape()) {
      this.steerAwayFromPlayer(deltaTime, this.alertAvoidTurnSpeed * 0.12);
      return;
    }

    this.steerAwayFromPlayer(deltaTime, this.alertAvoidTurnSpeed * 0.35);

    if (overlapRate < 0.22) {
      return;
    }

    const away = this.getAwayFromPlayer();

    if (away.lengthSqr() <= 0.001) {
      return;
    }

    const pos = this.node.position;
    const distance = this.baseMoveSpeed * 0.35 * overlapRate * deltaTime;

    this.node.setPosition(
      pos.x + away.x * distance,
      pos.y + away.y * distance,
      pos.z,
    );
  }

  private shouldEscapeFromPlayer() {
    if (this.isTooWeakToEscape()) {
      return false;
    }

    if (this.activity === EnemyActivity.ActiveGrower) {
      return this.getRemainingMassRatio() <= 0.86;
    }

    if (this.mode === EnemyMode.Chase || this.mode === EnemyMode.NativeChase) {
      return this.getRemainingMassRatio() <= Math.max(this.escapeStartLossRatio, 0.8);
    }

    if (this.startMass >= 900) {
      return this.getRemainingMassRatio() <= Math.max(this.escapeStartLossRatio, 0.78);
    }

    return this.getRemainingMassRatio() <= Math.max(this.escapeStartLossRatio, 0.74);
  }

  private isTooWeakToEscape() {
    const weakRatio =
      this.activity === EnemyActivity.ActiveGrower
        ? 0.22
        : this.mode === EnemyMode.Chase || this.mode === EnemyMode.NativeChase
          ? 0.24
          : this.startMass >= 900
            ? 0.26
            : 0.32;

    return this.getRemainingMassRatio() <= weakRatio;
  }

  private getEscapeProgress() {
    const remainingRatio = this.getRemainingMassRatio();
    const startRatio =
      this.activity === EnemyActivity.ActiveGrower
        ? 0.86
        : this.mode === EnemyMode.Chase || this.mode === EnemyMode.NativeChase
          ? Math.max(this.escapeStartLossRatio, 0.8)
          : this.startMass >= 900
            ? Math.max(this.escapeStartLossRatio, 0.78)
            : Math.max(this.escapeStartLossRatio, 0.74);
    const endRatio = Math.max(this.killMass / Math.max(this.startMass, 1), 0.12);
    const range = Math.max(startRatio - endRatio, 0.1);

    return this.clamp01((startRatio - remainingRatio) / range);
  }

  private getEscapeMobility() {
    const progress = this.getEscapeProgress();

    if (progress < 0.55) {
      return 0.25 + (progress / 0.55) * 0.75;
    }

    if (progress < 0.72) {
      return 1 + ((progress - 0.55) / 0.17) * 0.15;
    }

    return Math.max(0.16, 1.15 - ((progress - 0.72) / 0.28) * 0.99);
  }

  private getPlayerEscapePower() {
    if (!this.hasPlayerEscapePower) {
      this.playerEscapePower = this.rollPlayerEscapePower();
      this.hasPlayerEscapePower = true;
    }

    const remainingRatio = this.getRemainingMassRatio();
    const stamina =
      remainingRatio > 0.45
        ? 1
        : remainingRatio > 0.28
          ? 0.72
          : 0.42;

    return this.playerEscapePower * stamina;
  }

  private getPlayerScaleEscapeBoost() {
    const playerMass =
      this.player
        ?.getComponent(PlayerController)
        ?.getMass?.() ?? this.mass;
    const ratio = playerMass / Math.max(this.mass, 1);

    return Math.min(2.15, 1 + Math.sqrt(Math.max(0, ratio - 1)) * 0.34);
  }

  private getStageEscapeSpeedBoost() {
    if (this.stageEscapeBoostTimer <= 0) {
      return 1;
    }

    return 1 + this.stageEscapeBoostPower;
  }

  private refreshPressureEscapeBoost(overlapRate: number) {
    if (!this.canUseStageEscape()) {
      return;
    }

    const lossRatio = this.getDamageLossRatio();
    const typePower =
      this.activity === EnemyActivity.ActiveGrower
        ? 1.3
        : this.mode === EnemyMode.Chase || this.mode === EnemyMode.NativeChase
          ? 1.18
          : this.startMass >= 900
            ? 1.05
            : 0.82;
    const pressurePower =
      (0.12 + overlapRate * 0.22 + lossRatio * 0.28) * typePower;

    this.stageEscapeBoostTimer = Math.max(this.stageEscapeBoostTimer, 0.28);
    this.stageEscapeBoostPower = Math.max(
      this.stageEscapeBoostPower,
      Math.min(0.78, pressurePower),
    );
  }

  private getEscapeSpeedCap() {
    const playerMaxSpeed =
      this.player
        ?.getComponent(PlayerController)
        ?.getMaxSpeed?.() ?? 240;
    const scaleBoost = this.getPlayerScaleEscapeBoost();

    if (this.activity === EnemyActivity.ActiveGrower) {
      return playerMaxSpeed * Math.min(1.42, 1.14 + (scaleBoost - 1) * 0.26);
    }

    if (this.mode === EnemyMode.Chase || this.mode === EnemyMode.NativeChase) {
      return playerMaxSpeed * Math.min(1.28, 1.08 + (scaleBoost - 1) * 0.2);
    }

    if (this.startMass >= 900) {
      return playerMaxSpeed * Math.min(1.12, 0.9 + (scaleBoost - 1) * 0.18);
    }

    return playerMaxSpeed * 0.54;
  }

  private rollPlayerEscapePower() {
    const isHunter =
      this.mode === EnemyMode.Chase ||
      this.mode === EnemyMode.NativeChase;

    if (this.activity === EnemyActivity.ActiveGrower) {
      return Math.random() < 0.72
        ? 1.14 + Math.random() * 0.24
        : 0.58 + Math.random() * 0.14;
    }

    if (isHunter) {
      return Math.random() < 0.62
        ? 1.08 + Math.random() * 0.2
        : 0.54 + Math.random() * 0.12;
    }

    if (this.startMass >= 900) {
      return Math.random() < 0.48
        ? 0.96 + Math.random() * 0.2
        : 0.48 + Math.random() * 0.14;
    }

    return Math.random() < 0.24
      ? 0.62 + Math.random() * 0.12
      : 0.38 + Math.random() * 0.12;
  }

  private getRemainingMassRatio() {
    return this.mass / Math.max(this.startMass, 1);
  }

  private getPlayerAbsorbDamage(overlapRate: number, deltaTime: number) {
    const remainingRatio = this.getRemainingMassRatio();
    const effectiveOverlap = Math.max(0.22, overlapRate);
    const sizeMultiplier =
      this.startMass >= 900
        ? 12.2
        : this.startMass >= 150
          ? 7.2
          : 4.2;
    const finishMultiplier =
      remainingRatio <= 0.2
        ? 4
        : remainingRatio <= 0.38
          ? 2.8
          : remainingRatio <= 0.62
            ? 1.65
            : 1;
    const overlapMultiplier = 1 + Math.max(0, overlapRate - 0.28) * 1.15;

    const baseDamage =
      this.absorbSpeed *
      sizeMultiplier *
      finishMultiplier *
      overlapMultiplier *
      effectiveOverlap *
      deltaTime;
    const percentDamage = this.getPlayerAbsorbPercentDamage(
      effectiveOverlap,
      deltaTime,
    );

    return baseDamage + percentDamage;
  }

  private getPlayerAbsorbPercentDamage(overlapRate: number, deltaTime: number) {
    if (this.startMass < 150) {
      return 0;
    }

    const remainingRatio = this.getRemainingMassRatio();
    const rate =
      this.startMass >= 2500
        ? 0.068
        : this.startMass >= 900
          ? 0.052
          : 0.018;
    const healthMultiplier =
      remainingRatio > 0.55
        ? 1
        : remainingRatio > 0.28
          ? 0.88
          : 0.52;

    return (
      this.mass *
      rate *
      (0.25 + overlapRate * 0.75) *
      healthMultiplier *
      deltaTime
    );
  }

  private getKillRewardMass() {
    const cap =
      this.startMass >= 900
        ? 680
        : this.startMass >= 150
          ? 220
          : 38;

    return this.rewardMass + Math.min(this.startMass * 0.16, cap);
  }

  private getAwayFromPlayer() {
    const away = new Vec2();

    if (!this.player?.isValid) {
      return away;
    }

    away.set(
      this.node.position.x - this.player.position.x,
      this.node.position.y - this.player.position.y,
    );

    if (away.lengthSqr() > 0.001) {
      away.normalize();
    }

    return away;
  }

  private clamp01(value: number) {
    return Math.min(Math.max(value, 0), 1);
  }

  private endGame() {
    this.getGameManager()?.forceGameOver?.();
  }

  private updateSize() {
    const transform = this.node.getComponent(UITransform);

    if (!transform) {
      return;
    }

    const size = Math.max(
      this.minSize,
      Math.sqrt(this.getVisualMass()) * this.sizeScale,
    );

    transform.setContentSize(size, size);
    this.applyVisual();
    this.updateActiveGrowerSpeed();
  }

  private getVisualMass() {
    const lossRatio = this.getDamageLossRatio();

    if (lossRatio <= 0) {
      return this.mass;
    }

    if (this.startMass >= 900) {
      return this.mass * Math.max(0.2, 1 - lossRatio * 1.08);
    }

    if (this.startMass >= 150) {
      return this.mass * Math.max(0.42, 1 - lossRatio * 0.72);
    }

    return this.mass * Math.max(0.72, 1 - lossRatio * 0.36);
  }

  private getDamageLossRatio() {
    return this.clamp01(1 - this.getRemainingMassRatio());
  }

  private getDamageStage() {
    const lossRatio = this.getDamageLossRatio();

    if (lossRatio >= 0.62) {
      return 3;
    }

    if (lossRatio >= 0.38) {
      return 2;
    }

    if (lossRatio >= 0.18) {
      return 1;
    }

    return 0;
  }

  private updateDamageOverlay() {
    if (!this.damageOverlay) {
      return;
    }

    const stage = this.getDamageStage();

    this.damageOverlay.clear();

    if (stage <= 0) {
      return;
    }

    const radius = this.getRadius() * 0.9;
    const alpha = stage === 3 ? 38 : stage === 2 ? 28 : 18;

    this.damageOverlay.fillColor = new Color(255, 54, 34, alpha);
    this.damageOverlay.circle(0, 0, radius);
    this.damageOverlay.fill();
    this.damageOverlay.lineWidth = stage === 3 ? 4 : 3;
    this.damageOverlay.strokeColor = new Color(255, 82, 52, stage === 3 ? 185 : 125);
    this.damageOverlay.circle(0, 0, radius + 2);
    this.damageOverlay.stroke();
  }

  private tryTriggerStageEscape(overlapRate: number) {
    const stage = this.getDamageStage();

    if (stage <= this.triggeredEscapeStage) {
      return;
    }

    this.triggeredEscapeStage = stage;

    if (!this.canUseStageEscape() || this.isTooWeakToEscape()) {
      return;
    }

    if (Math.random() > this.getStageEscapeChance(stage)) {
      return;
    }

    this.forceStageEscape(stage, overlapRate);
  }

  private canUseStageEscape() {
    return (
      this.activity === EnemyActivity.ActiveGrower ||
      this.mode === EnemyMode.Chase ||
      this.mode === EnemyMode.NativeChase ||
      this.startMass >= 900
    );
  }

  private getStageEscapeChance(stage: number) {
    const stagePenalty = stage === 1 ? 0 : stage === 2 ? 0.12 : 0.28;

    if (this.activity === EnemyActivity.ActiveGrower) {
      return Math.max(0.48, 0.9 - stagePenalty * 0.7);
    }

    if (this.mode === EnemyMode.Chase || this.mode === EnemyMode.NativeChase) {
      return Math.max(0.42, 0.78 - stagePenalty * 0.75);
    }

    if (this.startMass >= 900) {
      return Math.max(0.32, 0.62 - stagePenalty * 0.75);
    }

    return 0;
  }

  private forceStageEscape(stage: number, overlapRate: number) {
    const away = this.getAwayFromPlayer();

    if (away.lengthSqr() <= 0.001) {
      return;
    }

    const typePower =
      this.activity === EnemyActivity.ActiveGrower
        ? 1.42
        : this.mode === EnemyMode.Chase || this.mode === EnemyMode.NativeChase
          ? 1.28
          : this.startMass >= 900
            ? 1.05
            : 0.86;
    const stagePower = stage === 1 ? 1 : stage === 2 ? 0.82 : 0.56;

    this.isEscapingFromPlayer = true;
    this.hasPlayerEscapePower = true;
    this.playerEscapePower = Math.max(this.playerEscapePower, typePower * stagePower);
    this.stageEscapeBoostTimer = Math.max(
      this.stageEscapeBoostTimer,
      stage === 1 ? 1.15 : stage === 2 ? 0.95 : 0.65,
    );
    this.stageEscapeBoostPower = Math.max(
      this.stageEscapeBoostPower,
      (0.55 + overlapRate * 0.45) * typePower * stagePower,
    );
    this.alertTimer = Math.max(this.alertTimer, this.alertDuration);
    this.playerAlertTimer = Math.max(this.playerAlertTimer, 1.2);
    this.escapeLockTimer = Math.max(this.escapeLockTimer, 2.1);
    this.direction.x = this.direction.x * 0.18 + away.x * 0.82;
    this.direction.y = this.direction.y * 0.18 + away.y * 0.82;

    if (this.direction.lengthSqr() > 0.001) {
      this.direction.normalize();
    }
  }

  private updateActiveGrowerSpeed() {
    if (this.activity !== EnemyActivity.ActiveGrower) {
      return;
    }

    if (this.isTooWeakToEscape()) {
      this.moveSpeed = this.baseMoveSpeed * 0.52;
      return;
    }

    const speedMultiplier =
      this.mass >= 900
        ? 1.18
        : this.mass >= 420
          ? 3.2
          : 4.1;

    const minSpeed =
      this.mass >= 900
        ? 36
        : this.mass >= 420
          ? 74
          : 88;

    this.moveSpeed = Math.max(this.baseMoveSpeed * speedMultiplier, minSpeed);
  }

  private triggerGrowthPulse(value = 0) {
    const ratio = value / Math.max(this.mass, 1);

    this.growthPulseStrength = Math.max(
      this.growthPulseStrength,
      Math.min(0.14, 0.035 + ratio * 1.3),
    );

    if (this.growthPulseTimer <= 0) {
      this.growthPulseTimer = this.pulseDuration;
    }
  }

  private triggerDamagePulse(value = 0) {
    const ratio = value / Math.max(this.mass, 1);

    this.damagePulseStrength = Math.max(
      this.damagePulseStrength,
      Math.min(0.2, 0.05 + ratio * 2.4),
    );

    if (this.damagePulseTimer <= 0) {
      this.damagePulseTimer = this.pulseDuration;
    }
  }

  private updateVisualPulse(deltaTime: number) {
    this.growthPulseTimer = Math.max(0, this.growthPulseTimer - deltaTime);
    this.damagePulseTimer = Math.max(0, this.damagePulseTimer - deltaTime);

    const growthProgress =
      this.growthPulseTimer > 0
        ? 1 - this.growthPulseTimer / this.pulseDuration
        : 1;
    const damageProgress =
      this.damagePulseTimer > 0
        ? 1 - this.damagePulseTimer / this.pulseDuration
        : 1;
    const growthScale =
      this.growthPulseTimer > 0
        ? Math.sin(growthProgress * Math.PI) * this.growthPulseStrength
        : 0;
    const damageScale =
      this.damagePulseTimer > 0
        ? Math.sin(damageProgress * Math.PI) * this.damagePulseStrength
        : 0;
    const scale = Math.min(1.14, Math.max(0.82, 1 + growthScale - damageScale));

    this.node.setScale(scale, scale, 1);
  }

  private getRadius() {
    return this.getNodeRadius(this.node);
  }

  private getCollisionRadius(node: Node) {
    return this.getNodeRadius(node) * this.collisionRadiusScale;
  }

  private getNodeRadius(node: Node) {
    const transform = node.getComponent(UITransform);

    if (!transform) {
      return 40;
    }

    return Math.max(transform.contentSize.width, transform.contentSize.height) / 2;
  }

  private getPlayerVisualTouchDistance() {
    if (!this.player?.isValid) {
      return this.escapeStopDistance;
    }

    return this.getRadius() + this.getNodeRadius(this.player);
  }

  private getPlayerEscapeStopDistance() {
    const visualDistance = this.getPlayerVisualTouchDistance() + this.visualEscapePadding;

    return Math.max(
      visualDistance,
      Math.min(this.escapeStopDistance, visualDistance + 110),
    );
  }

  private updateTimers(deltaTime: number) {
    this.alertTimer = Math.max(0, this.alertTimer - deltaTime);
    this.playerAlertTimer = Math.max(0, this.playerAlertTimer - deltaTime);
    this.escapeLockTimer = Math.max(0, this.escapeLockTimer - deltaTime);
    this.stageEscapeBoostTimer = Math.max(0, this.stageEscapeBoostTimer - deltaTime);
    if (this.stageEscapeBoostTimer <= 0) {
      this.stageEscapeBoostPower = 0;
    }
    this.wasEatenByEnemyTimer = Math.max(0, this.wasEatenByEnemyTimer - deltaTime);
    this.zoneIntentTimer = Math.max(0, this.zoneIntentTimer - deltaTime);

    if (
      this.hasEnemyEaterPosition &&
      this.wasEatenByEnemyTimer <= 0 &&
      Vec3.distance(this.node.position, this.enemyEaterPosition) < this.enemyEaterEscapeStopDistance
    ) {
      this.wasEatenByEnemyTimer = 0.15;
    }

    if (this.wasEatenByEnemyTimer <= 0) {
      this.hasEnemyEaterPosition = false;
    }

    if (
      this.zoneIntentTimer <= 0 &&
      this.wasEatenByEnemyTimer <= 0 &&
      !this.isEscapingFromPlayer &&
      !this.isChasing &&
      this.mode !== EnemyMode.NativeChase &&
      this.activity !== EnemyActivity.ActiveGrower
    ) {
      this.moveSpeed = this.baseMoveSpeed;
    }

    if (
      this.zoneIntentTimer <= 0 &&
      this.wasEatenByEnemyTimer <= 0 &&
      !this.isEscapingFromPlayer &&
      !this.isChasing &&
      this.activity === EnemyActivity.ActiveGrower
    ) {
      this.updateActiveGrowerSpeed();
    }

    if (!this.isEscapingFromPlayer) {
      return;
    }

    if (this.isTooWeakToEscape()) {
      this.isEscapingFromPlayer = false;
      this.hasPlayerEscapePower = false;
      this.escapeLockTimer = 0;
      this.moveSpeed = this.baseMoveSpeed * 0.42;
      return;
    }

    if (!this.player?.isValid) {
      this.isEscapingFromPlayer = false;
      this.hasPlayerEscapePower = false;
      this.moveSpeed = this.baseMoveSpeed;
      return;
    }

    const distanceToPlayer = Vec3.distance(this.node.position, this.player.position);

    if (distanceToPlayer >= this.getPlayerEscapeStopDistance()) {
      this.isEscapingFromPlayer = false;
      this.hasPlayerEscapePower = false;
      this.alertTimer = this.alertDuration;
      this.moveSpeed = this.baseMoveSpeed;
      this.updateActiveGrowerSpeed();
    }
  }

  private updateEcologyDirection(deltaTime: number) {
    if (this.isChasing) {
      return;
    }

    if (this.isEscapingFromPlayer) {
      this.steerAwayFromPlayer(deltaTime, this.absorbedEscapeTurnSpeed);
      return;
    }

    if (this.wasEatenByEnemyTimer > 0 && this.hasEnemyEaterPosition) {
      this.steerAwayFromPoint(
        this.enemyEaterPosition,
        this.absorbedEscapeTurnSpeed * 0.85,
        deltaTime,
      );
      return;
    }

    if (
      this.activity === EnemyActivity.ActiveGrower &&
      this.tryAvoidBiggerPlayer(deltaTime, this.alertAvoidRadius * 1.25)
    ) {
      return;
    }

    if (
      this.activity === EnemyActivity.ActiveGrower &&
      this.tryAvoidBiggerEnemy(deltaTime, this.alertAvoidRadius)
    ) {
      return;
    }

    if (this.alertTimer > 0 && this.tryAvoidBiggerPlayer(deltaTime)) {
      return;
    }

    if (
      this.alertTimer > 0 &&
      this.tryAvoidBiggerEnemy(deltaTime, this.alertAvoidRadius * 0.75)
    ) {
      return;
    }

    if (this.canForage) {
      this.steerToFood(deltaTime);
    }
  }

  private tryAvoidBiggerPlayer(deltaTime: number, radius = this.alertAvoidRadius) {
    if (radius <= 0) {
      return false;
    }

    if (!this.player?.isValid) {
      return false;
    }

    const playerController = this.player.getComponent(PlayerController);
    const playerMass = playerController?.getMass() ?? 0;

    if (playerMass < this.mass) {
      return false;
    }

    const distanceToPlayer = Vec3.distance(this.node.position, this.player.position);
    const avoidRadius = Math.max(
      Math.min(radius, this.escapeStopDistance * 0.75),
      this.getPlayerVisualTouchDistance() + this.visualEscapePadding * 0.5,
    );

    if (distanceToPlayer > avoidRadius) {
      return false;
    }

    this.steerAwayFromPlayer(deltaTime, this.alertAvoidTurnSpeed);
    return true;
  }

  private steerAwayFromPlayer(deltaTime: number, turnSpeed: number) {
    if (!this.player?.isValid) {
      return;
    }

    const away = new Vec2(
      this.node.position.x - this.player.position.x,
      this.node.position.y - this.player.position.y,
    );

    this.steerToward(away, turnSpeed, deltaTime);
  }

  private steerAwayFromPoint(point: Vec3, turnSpeed: number, deltaTime: number) {
    const away = new Vec2(
      this.node.position.x - point.x,
      this.node.position.y - point.y,
    );

    this.steerToward(away, turnSpeed, deltaTime);
  }

  private steerToFood(deltaTime: number) {
    const food = this.findNearestFood();

    if (!food) {
      return;
    }

    const toFood = new Vec2(
      food.position.x - this.node.position.x,
      food.position.y - this.node.position.y,
    );
    const turnSpeed =
      this.activity === EnemyActivity.ActiveGrower
        ? this.foodSteerSpeed * 1.6
        : this.foodSteerSpeed;

    this.steerToward(toFood, turnSpeed, deltaTime);
  }

  private steerToward(vector: Vec2, turnSpeed: number, deltaTime: number) {
    if (vector.lengthSqr() <= 0.001) {
      return;
    }

    vector.normalize();
    this.direction.x += (vector.x - this.direction.x) * turnSpeed * deltaTime;
    this.direction.y += (vector.y - this.direction.y) * turnSpeed * deltaTime;

    if (this.direction.lengthSqr() > 0.001) {
      this.direction.normalize();
    }
  }

  private findNearestFood() {
    if (!this.foodRoot?.isValid) {
      return null;
    }

    const senseRange =
      this.activity === EnemyActivity.ActiveGrower
        ? this.activeFoodSenseRange
        : this.foodSenseRange;
    let nearest: Node | null = null;
    let nearestDistance = senseRange;

    for (const food of this.foodRoot.children) {
      const distance = Vec3.distance(this.node.position, food.position);

      if (distance < nearestDistance) {
        nearest = food;
        nearestDistance = distance;
      }
    }

    return nearest;
  }

  private checkEatFood() {
    if (!this.canForage || !this.foodRoot?.isValid) {
      return;
    }

    const eatDistance = this.getRadius() + 8;

    for (let i = this.foodRoot.children.length - 1; i >= 0; i--) {
      const food = this.foodRoot.children[i];
      const distance = Vec3.distance(this.node.position, food.position);

      if (distance > eatDistance) {
        continue;
      }

      const baseMass = food.name === "BonusFood" ? this.bonusFoodMass : this.foodMass;
      const gainedMass =
        baseMass * (this.activity === EnemyActivity.ActiveGrower ? 2.2 : 1);

      food.destroy();
      this.mass += gainedMass;
      this.startMass = Math.max(this.startMass, this.mass);
      this.triggeredEscapeStage = 0;
      this.triggerGrowthPulse(gainedMass);
      this.updateSize();
      this.spawnNewFood();
      return;
    }
  }

  private checkEnemyCollision(deltaTime: number) {
    if (!this.enemyRoot?.isValid || this.mass <= this.killMass) {
      return;
    }

    for (const other of this.enemyRoot.children) {
      if (other === this.node || !other.isValid) {
        continue;
      }

      const otherController = other.getComponent(EnemyController);

      if (
        !otherController ||
        otherController.mass <= otherController.killMass ||
        this.mass < otherController.mass * this.eatRatio
      ) {
        continue;
      }

      const distance = Vec3.distance(this.node.position, other.position);
      const touchDistance =
        this.getCollisionRadius(this.node) + otherController.getCollisionRadius(other);

      if (distance > touchDistance) {
        continue;
      }

      const overlapRate = Math.min((touchDistance - distance) / touchDistance, 1);
      const damage = Math.min(
        otherController.mass - otherController.killMass,
        this.absorbSpeed * this.passiveEnemyAbsorbMultiplier * overlapRate * deltaTime,
      );

      if (damage <= 0) {
        continue;
      }

      otherController.loseMassToEnemy(damage, this.node.position, this.getRadius());
      this.mass += damage;
      this.startMass = Math.max(this.startMass, this.mass);
      this.triggeredEscapeStage = 0;
      if (damage > 0.4) {
        this.triggerGrowthPulse(damage);
      }
      this.updateSize();

      if (otherController.mass <= otherController.killMass) {
        this.mass += otherController.mass;
        this.startMass = Math.max(this.startMass, this.mass);
        this.triggeredEscapeStage = 0;
        this.triggerGrowthPulse(otherController.mass);
        this.updateSize();
        other.destroy();
      }
    }
  }

  private loseMassToEnemy(value: number, eaterPosition: Vec3, eaterRadius: number) {
    this.mass = Math.max(this.killMass, this.mass - value);
    this.triggerDamagePulse(value);
    this.wasEatenByEnemyTimer = Math.max(this.wasEatenByEnemyTimer, 1.6);
    this.alertTimer = Math.max(this.alertTimer, 1.8);
    this.enemyEaterPosition.set(eaterPosition);
    this.enemyEaterEscapeStopDistance =
      eaterRadius + this.getRadius() + this.visualEscapePadding * 1.25;
    this.hasEnemyEaterPosition = true;
    this.updateSize();
    this.moveSpeed = Math.max(this.moveSpeed, this.getEnemyEaterEscapeSpeed());
    this.pushAwayFromEnemyEater();
  }

  private getEnemyEaterEscapeSpeed() {
    if (this.isTooWeakToEscape()) {
      return this.baseMoveSpeed * 0.42;
    }

    const isHunter =
      this.mode === EnemyMode.Chase ||
      this.mode === EnemyMode.NativeChase;
    const mobility = this.getEscapeMobility();
    const typeBoost =
      this.activity === EnemyActivity.ActiveGrower
        ? 4.4
        : isHunter
          ? 3.35
          : this.startMass >= 900
            ? 2.2
            : 1.85;
    const minSpeed =
      this.activity === EnemyActivity.ActiveGrower
        ? 94
        : isHunter
          ? 76
          : this.startMass >= 900
            ? 44
            : 42;
    const cap =
      this.activity === EnemyActivity.ActiveGrower
        ? 152
        : isHunter
          ? 128
          : this.startMass >= 900
            ? 76
            : 78;

    return Math.min(
      cap,
      Math.max(minSpeed, this.baseMoveSpeed * (0.75 + mobility * typeBoost)),
    );
  }

  private pushAwayFromEnemyEater() {
    if (!this.hasEnemyEaterPosition) {
      return;
    }

    const away = new Vec2(
      this.node.position.x - this.enemyEaterPosition.x,
      this.node.position.y - this.enemyEaterPosition.y,
    );

    if (away.lengthSqr() <= 0.001) {
      return;
    }

    away.normalize();
    this.direction.x = this.direction.x * 0.25 + away.x * 0.75;
    this.direction.y = this.direction.y * 0.25 + away.y * 0.75;

    if (this.direction.lengthSqr() > 0.001) {
      this.direction.normalize();
    }
  }

  applyZoneThreat(center: Vec3, radius: number, deltaTime: number, strength: number) {
    const distance = Vec3.distance(this.node.position, center);

    if (distance > radius) {
      return;
    }

    const away = new Vec2(
      this.node.position.x - center.x,
      this.node.position.y - center.y,
    );

    if (away.lengthSqr() <= 0.001) {
      away.set(Math.random() - 0.5, Math.random() - 0.5);
    }

    const urgency = 1 - distance / radius;

    this.steerToward(away, this.alertAvoidTurnSpeed + urgency * 8, deltaTime);
    this.moveSpeed = Math.max(
      this.moveSpeed,
      this.baseMoveSpeed * (1.2 + strength * 1.25 + urgency * 0.7),
    );
    this.zoneIntentTimer = 0.35;
    this.alertTimer = Math.max(this.alertTimer, 0.8);
  }

  seekZone(center: Vec3, deltaTime: number, strength: number) {
    const toCenter = new Vec2(
      center.x - this.node.position.x,
      center.y - this.node.position.y,
    );

    this.steerToward(toCenter, this.alertAvoidTurnSpeed * 0.8, deltaTime);
    this.moveSpeed = Math.max(this.moveSpeed, this.baseMoveSpeed * (1 + strength));
    this.zoneIntentTimer = 0.35;
  }

  applyZoneDamage(value: number) {
    this.mass -= value;
    this.triggerDamagePulse(value);

    if (this.mass <= this.killMass) {
      this.node.destroy();
      return true;
    }

    this.updateSize();
    return false;
  }

  getMassValue() {
    return this.mass;
  }

  private tryAvoidBiggerEnemy(deltaTime: number, radius: number) {
    if (!this.enemyRoot?.isValid || radius <= 0) {
      return false;
    }

    const away = new Vec2();
    const maxRadius = Math.min(radius, this.escapeStopDistance * 0.55);

    for (const other of this.enemyRoot.children) {
      if (other === this.node || !other.isValid) {
        continue;
      }

      const otherController = other.getComponent(EnemyController);

      if (!otherController || otherController.mass < this.mass) {
        continue;
      }

      const distance = Vec3.distance(this.node.position, other.position);

      if (distance > maxRadius || distance <= 0.001) {
        continue;
      }

      const weight = 1 - distance / maxRadius;

      away.x += ((this.node.position.x - other.position.x) / distance) * weight;
      away.y += ((this.node.position.y - other.position.y) / distance) * weight;
    }

    if (away.lengthSqr() <= 0.001) {
      return false;
    }

    this.steerToward(away, this.alertAvoidTurnSpeed, deltaTime);
    return true;
  }

  private spawnNewFood() {
    const gameManager = this.getGameManager();

    gameManager?.spawnOneFood?.();
  }

  private isGameActionPaused() {
    return this.getGameManager()?.isActionPaused?.() ?? false;
  }

  private getGameManager() {
    const gameRoot = director
      .getScene()
      ?.getChildByName("Canvas")
      ?.getChildByName("GameRoot");

    return gameRoot?.getComponent("GameManager") as any;
  }
}
