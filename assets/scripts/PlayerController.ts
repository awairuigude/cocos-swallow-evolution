import {
  _decorator,
  Component,
  input,
  Input,
  EventMouse,
  Vec2,
  Vec3,
  Node,
  Prefab,
  find,
  instantiate,
  view,
  UITransform,
  director,
  Label,
  UIOpacity,
  Color,
  Graphics,
} from "cc";

const { ccclass, property } = _decorator;

enum RecoverState {
  Normal,
  Penalty,
  Bonus,
}

type PlayerRunStats = {
  normalFoodCount: number;
  bonusFoodCount: number;
  normalFoodMass: number;
  bonusFoodMass: number;
  enemyAbsorbMass: number;
  killRewardMass: number;
  idleRecoverMass: number;
  penaltyRecoverMass: number;
  bonusRecoverMass: number;
  sprayCostMass: number;
  enemyDamageTakenMass: number;
  zoneDamageTakenMass: number;
  killCount: number;
  maxMass: number;
};

@ccclass("PlayerController")
export class PlayerController extends Component {
  @property
  sprayPower = 240;

  @property
  sprayCostPerSecond = 1.25;

  @property
  initialMass = 180;

  @property
  penaltyBaseRatio = 0.7;

  @property
  penaltyRatioStep = 0.03;

  @property
  penaltyStepSeconds = 10;

  @property
  penaltyMaxRatio = 0.88;

  @property
  penaltyDuration = 7;

  @property
  penaltyRecoverRatioGap = 0.28;

  @property
  bonusRecoverRatioGap = 0.58;

  @property
  idleGrowMassPerSecond = 0.18;

  @property
  bonusExitEaseTime = 1.2;

  @property
  foodMass = 10;

  @property
  bonusFoodMass = 30;

  @property
  fatigueTriggerRatio = 0.025;

  @property
  fatigueCostMultiplier = 18;

  @property
  fatigueRecoverPerSecond = 6;

  @property
  sizeScale = 4;

  @property
  minSize = 32;

  @property
  maxSpeed = 240;

  @property
  drag = 0.975;

  @property
  mapWidth = 3600;

  @property
  mapHeight = 2400;

  @property
  edgeProbeDistance = 46;

  @property
  pressureDamageMultiplier = 18;

  @property(Label)
  massLabel: Label | null = null;

  @property(Prefab)
  sprayParticlePrefab: Prefab | null = null;

  @property(Node)
  bulletRoot: Node | null = null;

  @property(Node)
  effectRoot: Node | null = null;

  @property(Prefab)
  eatParticlePrefab: Prefab | null = null;

  @property(Prefab)
  playerGainRingPrefab: Prefab | null = null;

  @property(Prefab)
  playerDangerRingPrefab: Prefab | null = null;

  @property
  sprayParticleInterval = 0.06;

  @property
  sprayParticleOffset = 8;

  private mass = 400;
  private isPressing = false;
  private thrustDir = new Vec2();
  private velocity = new Vec2();
  private foodRoot: Node | null = null;
  private recoverState = RecoverState.Normal;
  private elapsedTime = 0;
  private penaltyTimer = 0;
  private penaltyStartMass = 0;
  private penaltyTargetMass = 0;
  private bonusTargetMass = 0;
  private bonusEaseTimer = 0;
  private sprayFatigueMass = 0;
  private sprayParticleTimer = 0;
  private gainEffectCooldown = 0;
  private dangerEffectCooldown = 0;
  private growthPulseTimer = 0;
  private growthPulseDuration = 0.24;
  private growthPulseStrength = 0;
  private damagePulseTimer = 0;
  private damagePulseDuration = 0.22;
  private damagePulseStrength = 0;
  private dangerOverlay: Graphics | null = null;
  private dangerOverlayIntensity = 0;
  private absorbDamageMultiplier = 1;
  private killRewardMultiplier = 1;
  private damageTakenMultiplier = 1;
  private zoneDamageMultiplier = 1;
  private chainHuntTimer = 0;
  private chainHuntAbsorbBonus = 0;
  private swallowRadiusBonus = 0;
  private momentumHarvestTimer = 0;
  private momentumHarvestSpeedBonus = 0;
  private dangerOverlayBoost = 1;
  private runStats: PlayerRunStats = this.createEmptyRunStats();
  private sprayParticles: {
    node: Node;
    direction: Vec2;
    age: number;
  }[] = [];
  private effects: {
    node: Node;
    age: number;
    duration: number;
    startScale: number;
    endScale: number;
  }[] = [];

  onEnable() {
    this.mass = this.initialMass;
    this.recoverState = RecoverState.Normal;
    this.elapsedTime = 0;
    this.penaltyTimer = 0;
    this.penaltyStartMass = 0;
    this.penaltyTargetMass = 0;
    this.bonusTargetMass = 0;
    this.bonusEaseTimer = 0;
    this.sprayFatigueMass = 0;
    this.sprayParticleTimer = 0;
    this.gainEffectCooldown = 0;
    this.dangerEffectCooldown = 0;
    this.growthPulseTimer = 0;
    this.growthPulseStrength = 0;
    this.damagePulseTimer = 0;
    this.damagePulseStrength = 0;
    this.dangerOverlayIntensity = 0;
    this.absorbDamageMultiplier = 1;
    this.killRewardMultiplier = 1;
    this.damageTakenMultiplier = 1;
    this.zoneDamageMultiplier = 1;
    this.chainHuntTimer = 0;
    this.chainHuntAbsorbBonus = 0;
    this.swallowRadiusBonus = 0;
    this.momentumHarvestTimer = 0;
    this.momentumHarvestSpeedBonus = 0;
    this.dangerOverlayBoost = 1;
    this.runStats = this.createEmptyRunStats();
    this.runStats.maxMass = this.mass;
    this.sprayParticles.length = 0;
    this.effects.length = 0;
    this.velocity.set(0, 0);
    this.node.setScale(1, 1, 1);
    this.foodRoot = find("FoodRoot", this.node.parent);
    this.effectRoot = this.effectRoot ?? find("EffectRoot", this.node.parent);
    this.createDangerOverlay();
    this.updateSizeByMass();
    this.updateMassLabel();

    input.on(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
    input.on(Input.EventType.MOUSE_MOVE, this.onMouseMove, this);
    input.on(Input.EventType.MOUSE_UP, this.onMouseUp, this);
  }

  onDisable() {
    input.off(Input.EventType.MOUSE_DOWN, this.onMouseDown, this);
    input.off(Input.EventType.MOUSE_MOVE, this.onMouseMove, this);
    input.off(Input.EventType.MOUSE_UP, this.onMouseUp, this);
  }

  update(deltaTime: number) {
    if (this.isGameActionPaused()) {
      return;
    }

    this.elapsedTime += deltaTime;
    this.chainHuntTimer = Math.max(0, this.chainHuntTimer - deltaTime);
    this.momentumHarvestTimer = Math.max(0, this.momentumHarvestTimer - deltaTime);
    this.updateMassRecovery(deltaTime);

    if (this.canSpray()) {
      this.applySpray(deltaTime);
    } else {
      this.recoverSprayFatigue(deltaTime);
    }

    this.applyDrag();
    this.limitVelocity();
    this.move(deltaTime);
    this.updateSprayParticles(deltaTime);
    this.updateFeedbackEffects(deltaTime);
    this.updateGrowthPulse(deltaTime);
    this.updateDangerOverlay(deltaTime);
    this.checkEatFood();
  }

  private canSpray() {
    return this.isPressing && this.recoverState !== RecoverState.Penalty;
  }

  private createEmptyRunStats(): PlayerRunStats {
    return {
      normalFoodCount: 0,
      bonusFoodCount: 0,
      normalFoodMass: 0,
      bonusFoodMass: 0,
      enemyAbsorbMass: 0,
      killRewardMass: 0,
      idleRecoverMass: 0,
      penaltyRecoverMass: 0,
      bonusRecoverMass: 0,
      sprayCostMass: 0,
      enemyDamageTakenMass: 0,
      zoneDamageTakenMass: 0,
      killCount: 0,
      maxMass: 0,
    };
  }

  private updateMaxMassStat() {
    this.runStats.maxMass = Math.max(this.runStats.maxMass, this.mass);
  }

  private applySpray(deltaTime: number) {
    this.velocity.x -= this.thrustDir.x * this.sprayPower * deltaTime;
    this.velocity.y -= this.thrustDir.y * this.sprayPower * deltaTime;

    const baseCost = this.sprayCostPerSecond * deltaTime;
    this.sprayFatigueMass += baseCost;

    const costMultiplier =
      this.sprayFatigueMass >= this.getFatigueTriggerMass()
        ? this.fatigueCostMultiplier
        : 1;

    const cost = Math.min(this.mass, baseCost * costMultiplier);

    const beforeMass = this.mass;

    this.mass -= cost;
    this.spawnSprayParticle(deltaTime);

    if (
      this.recoverState === RecoverState.Normal &&
      this.mass <= this.getPenaltyMass()
    ) {
      this.mass = this.getPenaltyMass();
      this.enterPenalty();
    }

    this.runStats.sprayCostMass += Math.max(0, beforeMass - this.mass);

    this.updateSizeByMass();
    this.updateMassLabel();
  }

  private spawnSprayParticle(deltaTime: number) {
    if (!this.sprayParticlePrefab || !this.bulletRoot) {
      return;
    }

    this.sprayParticleTimer += deltaTime;

    if (this.sprayParticleTimer < this.sprayParticleInterval) {
      return;
    }

    this.sprayParticleTimer = 0;

    const particle = instantiate(this.sprayParticlePrefab);
    const radius = this.getRadius();
    const startX = this.node.position.x + this.thrustDir.x * (radius + this.sprayParticleOffset);
    const startY = this.node.position.y + this.thrustDir.y * (radius + this.sprayParticleOffset);

    particle.setParent(this.bulletRoot);
    particle.setPosition(startX, startY, 0);

    const transform = particle.getComponent(UITransform);

    if (transform) {
      transform.setContentSize(8, 8);
    }

    if (!particle.getComponent(UIOpacity)) {
      particle.addComponent(UIOpacity);
    }

    this.sprayParticles.push({
      node: particle,
      direction: this.thrustDir.clone(),
      age: 0,
    });
  }

  private updateSprayParticles(deltaTime: number) {
    for (let i = this.sprayParticles.length - 1; i >= 0; i--) {
      const particle = this.sprayParticles[i];

      if (!particle.node.isValid) {
        this.sprayParticles.splice(i, 1);
        continue;
      }

      particle.age += deltaTime;

      const pos = particle.node.position;
      const nextX = pos.x + particle.direction.x * 320 * deltaTime;
      const nextY = pos.y + particle.direction.y * 320 * deltaTime;
      const opacity = particle.node.getComponent(UIOpacity);

      particle.node.setPosition(nextX, nextY, pos.z);

      if (opacity) {
        opacity.opacity = Math.max(0, 255 * (1 - particle.age / 0.45));
      }

      if (particle.age >= 0.45) {
        particle.node.destroy();
        this.sprayParticles.splice(i, 1);
      }
    }
  }

  private updateMassRecovery(deltaTime: number) {
    if (this.recoverState === RecoverState.Penalty) {
      this.updatePenaltyRecovery(deltaTime);
      return;
    }

    if (this.recoverState === RecoverState.Bonus) {
      this.updateBonusRecovery(deltaTime);
      return;
    }

    const gainedMass = this.idleGrowMassPerSecond * deltaTime;

    this.mass += gainedMass;
    this.runStats.idleRecoverMass += gainedMass;
    this.updateMaxMassStat();

    if (this.mass <= this.getPenaltyMass()) {
      this.enterPenalty();
    }

    this.updateSizeByMass();
    this.updateMassLabel();
  }

  private enterPenalty() {
    this.recoverState = RecoverState.Penalty;
    this.penaltyTimer = 0;
    this.penaltyStartMass = this.mass;
    this.penaltyTargetMass = this.getPenaltyTargetMass();
    this.bonusTargetMass = this.getBonusTargetMass();
    this.bonusEaseTimer = 0;
    this.sprayFatigueMass = 0;
    this.velocity.set(0, 0);
  }

  private updatePenaltyRecovery(deltaTime: number) {
    const oldProgress = Math.min(this.penaltyTimer / this.penaltyDuration, 1);

    this.penaltyTimer = Math.min(this.penaltyTimer + deltaTime, this.penaltyDuration);

    const newProgress = Math.min(this.penaltyTimer / this.penaltyDuration, 1);
    const penaltyRecoverMass = this.penaltyTargetMass - this.penaltyStartMass;
    const gainedMass =
      penaltyRecoverMass *
      (this.penaltyCurve(newProgress) - this.penaltyCurve(oldProgress));

    this.mass += gainedMass;
    this.runStats.penaltyRecoverMass += gainedMass;
    this.updateMaxMassStat();

    if (newProgress >= 1) {
      this.recoverState = RecoverState.Bonus;
    }

    this.updateSizeByMass();
    this.updateMassLabel();
  }

  private updateBonusRecovery(deltaTime: number) {
    const penaltyRecoverMass = this.penaltyTargetMass - this.penaltyStartMass;
    const maxRecoverSpeed = (penaltyRecoverMass / this.penaltyDuration) * 2;
    const gainedMass = Math.max(0, Math.min(
      this.bonusTargetMass - this.mass,
      maxRecoverSpeed * deltaTime,
    ));

    this.mass += gainedMass;
    this.runStats.bonusRecoverMass += gainedMass;
    this.updateMaxMassStat();

    if (this.mass >= this.bonusTargetMass) {
      this.mass = this.bonusTargetMass;
      this.bonusEaseTimer += deltaTime;

      if (this.bonusEaseTimer >= this.bonusExitEaseTime) {
        this.recoverState = RecoverState.Normal;
      }
    }

    this.updateSizeByMass();
    this.updateMassLabel();
  }

  private getPenaltyMass() {
    return this.initialMass * this.getPenaltyRatio();
  }

  private getPenaltyTargetMass() {
    return this.initialMass * (this.getPenaltyRatio() + this.penaltyRecoverRatioGap);
  }

  private getBonusTargetMass() {
    return (
      this.initialMass *
      (this.getPenaltyRatio() + this.penaltyRecoverRatioGap + this.bonusRecoverRatioGap)
    );
  }

  private getPenaltyRatio() {
    const level = Math.floor(this.elapsedTime / this.penaltyStepSeconds);
    const ratio = this.penaltyBaseRatio + this.penaltyRatioStep * level;

    return Math.min(ratio, this.penaltyMaxRatio);
  }

  private getFatigueTriggerMass() {
    return this.initialMass * this.fatigueTriggerRatio;
  }

  private recoverSprayFatigue(deltaTime: number) {
    if (this.isPressing) {
      return;
    }

    this.sprayFatigueMass = Math.max(
      0,
      this.sprayFatigueMass - this.fatigueRecoverPerSecond * deltaTime,
    );
  }

  private penaltyCurve(progress: number) {
    if (progress <= 0.5) {
      return progress * progress;
    }

    const reverse = 1 - progress;

    return 1 - reverse * reverse;
  }

  private applyDrag() {
    this.velocity.x *= this.drag;
    this.velocity.y *= this.drag;
  }

  private limitVelocity() {
    const speed = this.velocity.length();
    const currentMaxSpeed = this.getMaxSpeed();

    if (speed <= currentMaxSpeed) {
      return;
    }

    this.velocity.multiplyScalar(currentMaxSpeed / speed);
  }

  private move(deltaTime: number) {
    const pos = this.node.position;
    const nextX = pos.x + this.velocity.x * deltaTime;
    const nextY = pos.y + this.velocity.y * deltaTime;
    const limitedPosition = this.limitPosition(nextX, nextY, pos.z);

    if (limitedPosition.x !== nextX) {
      this.velocity.x = 0;
    }

    if (limitedPosition.y !== nextY) {
      this.velocity.y = 0;
    }

    this.node.setPosition(limitedPosition);
  }

  private limitPosition(x: number, y: number, z: number) {
    const radius = this.getRadius();
    const minX = -this.mapWidth / 2 + radius - this.edgeProbeDistance;
    const maxX = this.mapWidth / 2 - radius + this.edgeProbeDistance;
    const minY = -this.mapHeight / 2 + radius - this.edgeProbeDistance;
    const maxY = this.mapHeight / 2 - radius + this.edgeProbeDistance;
    const limitedX = Math.min(Math.max(x, minX), maxX);
    const limitedY = Math.min(Math.max(y, minY), maxY);

    return new Vec3(limitedX, limitedY, z);
  }

  private onMouseDown(event: EventMouse) {
    this.isPressing = true;
    this.updateThrustDir(event);
  }

  private onMouseMove(event: EventMouse) {
    if (!this.isPressing) {
      return;
    }

    this.updateThrustDir(event);
  }

  private onMouseUp() {
    this.isPressing = false;
  }

  private updateThrustDir(event: EventMouse) {
    const mouse = event.getUILocation();
    const visibleSize = view.getVisibleSize();
    const parentPosition = this.node.parent?.position ?? new Vec3();
    const mouseX = mouse.x - visibleSize.width / 2;
    const mouseY = mouse.y - visibleSize.height / 2;
    const pos = this.node.position;

    this.thrustDir.set(
      mouseX - parentPosition.x - pos.x,
      mouseY - parentPosition.y - pos.y,
    );

    if (this.thrustDir.lengthSqr() > 0.001) {
      this.thrustDir.normalize();
    }
  }

  private checkEatFood() {
    if (!this.foodRoot) {
      return;
    }

    const playerPos = this.node.position;
    const eatDistance = this.getRadius() + 4 + this.swallowRadiusBonus * 0.65;

    for (let i = this.foodRoot.children.length - 1; i >= 0; i--) {
      const food = this.foodRoot.children[i];
      const distance = Vec3.distance(playerPos, food.position);

      if (distance <= eatDistance) {
        const massValue = food.name === "BonusFood" ? this.bonusFoodMass : this.foodMass;
        const effectPosition = food.position.clone();

        food.destroy();
        const isBonusFood = food.name === "BonusFood";

        this.gainMass(massValue, isBonusFood);

        if (isBonusFood) {
          this.runStats.bonusFoodCount += 1;
          this.runStats.bonusFoodMass += massValue;
        } else {
          this.runStats.normalFoodCount += 1;
          this.runStats.normalFoodMass += massValue;
        }

        this.playGainFeedback(effectPosition, isBonusFood ? 1.4 : 0.75, false);
        this.spawnNewFood();
      }
    }
  }

  private gainMass(value: number, pulse = false) {
    this.mass += value;
    this.updateMaxMassStat();

    if (pulse) {
      this.triggerGrowthPulse(value);
    }

    this.updateSizeByMass();
    this.updateMassLabel();
  }

  private triggerGrowthPulse(value: number) {
    const ratio = value / Math.max(this.mass, 1);

    const strength = Math.min(0.16, 0.035 + ratio * 1.6);

    this.growthPulseStrength = Math.max(this.growthPulseStrength, strength);

    if (this.growthPulseTimer <= 0) {
      this.growthPulseTimer = this.growthPulseDuration;
    }
  }

  private updateGrowthPulse(deltaTime: number) {
    this.damagePulseTimer = Math.max(0, this.damagePulseTimer - deltaTime);

    if (this.growthPulseTimer <= 0 && this.damagePulseTimer <= 0) {
      this.node.setScale(1, 1, 1);
      return;
    }

    this.growthPulseTimer = Math.max(0, this.growthPulseTimer - deltaTime);

    const growthProgress =
      this.growthPulseTimer > 0
        ? 1 - this.growthPulseTimer / this.growthPulseDuration
        : 1;
    const damageProgress =
      this.damagePulseTimer > 0
        ? 1 - this.damagePulseTimer / this.damagePulseDuration
        : 1;
    const growthScale =
      this.growthPulseTimer > 0
        ? Math.sin(growthProgress * Math.PI) * this.growthPulseStrength
        : 0;
    const damageScale =
      this.damagePulseTimer > 0
        ? Math.sin(damageProgress * Math.PI) * this.damagePulseStrength
        : 0;
    const scale = Math.max(0.68, 1 + growthScale - damageScale);

    this.node.setScale(scale, scale, 1);
  }

  private updateSizeByMass() {
    const transform = this.node.getComponent(UITransform);

    if (!transform) {
      return;
    }

    const size = Math.max(this.minSize, Math.sqrt(this.mass) * this.sizeScale);

    transform.setContentSize(size, size);
  }

  private getRadius() {
    const transform = this.node.getComponent(UITransform);

    if (!transform) {
      return this.minSize / 2;
    }

    return Math.max(transform.contentSize.width, transform.contentSize.height) / 2;
  }

  private updateMassLabel() {
    if (!this.massLabel) {
      return;
    }

    this.massLabel.string = `质量：${Math.floor(this.mass)}`;
  }

  getMass() {
    return Math.floor(this.mass);
  }

  getRunStats() {
    return {
      ...this.runStats,
      finalMass: Math.floor(this.mass),
      maxMass: Math.floor(this.runStats.maxMass),
      totalFoodMass: Math.floor(this.runStats.normalFoodMass + this.runStats.bonusFoodMass),
      totalEnemyGainMass: Math.floor(this.runStats.enemyAbsorbMass + this.runStats.killRewardMass),
      totalRecoverMass: Math.floor(
        this.runStats.idleRecoverMass +
          this.runStats.penaltyRecoverMass +
          this.runStats.bonusRecoverMass,
      ),
      totalLossMass: Math.floor(
        this.runStats.sprayCostMass +
          this.runStats.enemyDamageTakenMass +
          this.runStats.zoneDamageTakenMass,
      ),
    };
  }

  getMaxSpeed() {
    const momentumBonus = this.momentumHarvestTimer > 0
      ? this.momentumHarvestSpeedBonus
      : 0;

    return this.maxSpeed * (1 + momentumBonus);
  }

  getSwallowRadiusBonus() {
    return this.swallowRadiusBonus;
  }

  addMass(value: number) {
    const beforeMass = this.mass;

    this.gainMass(value, false);
    this.runStats.enemyAbsorbMass += Math.max(0, this.mass - beforeMass);
  }

  addMassWithFeedback(value: number, position: Vec3, scale = 1) {
    const beforeMass = this.mass;

    this.runStats.killCount += 1;
    this.triggerChainHunt();
    this.triggerMomentumHarvest();
    this.gainMass(value, true);
    this.runStats.killRewardMass += Math.max(0, this.mass - beforeMass);
    this.playGainFeedback(position, scale, true);
  }

  loseMass(value: number, dangerIntensity = 1, source: "enemy" | "zone" = "enemy") {
    const finalValue =
      value *
      this.damageTakenMultiplier *
      (source === "zone" ? this.zoneDamageMultiplier : 1);
    const beforeMass = this.mass;

    this.mass = Math.max(1, this.mass - finalValue);
    const actualLoss = Math.max(0, beforeMass - this.mass);

    if (source === "zone") {
      this.runStats.zoneDamageTakenMass += actualLoss;
    } else {
      this.runStats.enemyDamageTakenMass += actualLoss;
    }
    this.updateSizeByMass();
    this.updateMassLabel();
    this.triggerDamagePulse(finalValue);
    this.dangerOverlayIntensity = Math.min(
      1,
      Math.max(
        this.dangerOverlayIntensity,
        (0.2 + dangerIntensity * 0.75) * this.dangerOverlayBoost,
      ),
    );
    this.playDangerFeedback();
  }

  private triggerDamagePulse(value: number) {
    const ratio = value / Math.max(this.mass, 1);

    const strength = Math.min(0.18, 0.045 + ratio * 2.2);

    this.damagePulseStrength = Math.max(this.damagePulseStrength, strength);

    if (this.damagePulseTimer <= 0) {
      this.damagePulseTimer = this.damagePulseDuration;
    }
  }

  addImpulse(direction: Vec2, power: number) {
    if (direction.lengthSqr() <= 0.001) {
      return;
    }

    const normalized = direction.clone().normalize();

    this.velocity.x += normalized.x * power;
    this.velocity.y += normalized.y * power;
  }

  getPressureDamageMultiplier() {
    return this.pressureDamageMultiplier;
  }

  getAbsorbDamageMultiplier() {
    const chainBonus = this.chainHuntTimer > 0 ? this.chainHuntAbsorbBonus : 0;

    return this.absorbDamageMultiplier * (1 + chainBonus);
  }

  getKillRewardMultiplier() {
    return this.killRewardMultiplier;
  }

  applyRogueUpgrade(upgradeId: string) {
    if (upgradeId === "jet_core") {
      this.sprayPower *= 1.14;
      this.maxSpeed *= 1.08;
      return;
    }

    if (upgradeId === "efficient_spray") {
      this.sprayCostPerSecond *= 0.82;
      this.fatigueTriggerRatio += 0.006;
      return;
    }

    if (upgradeId === "cooling_spray") {
      this.fatigueCostMultiplier *= 0.78;
      this.fatigueRecoverPerSecond += 2.5;
      return;
    }

    if (upgradeId === "hunting_teeth") {
      this.absorbDamageMultiplier *= 1.32;
      return;
    }

    if (upgradeId === "finish_reward") {
      this.killRewardMultiplier *= 1.35;
      this.absorbDamageMultiplier *= 1.08;
      return;
    }

    if (upgradeId === "resource_stomach") {
      this.foodMass += 2;
      this.bonusFoodMass += 14;
      return;
    }

    if (upgradeId === "natural_recover") {
      this.idleGrowMassPerSecond += 0.22;
      this.penaltyDuration *= 0.9;
      return;
    }

    if (upgradeId === "damage_buffer") {
      this.damageTakenMultiplier *= 0.84;
      this.pressureDamageMultiplier *= 0.84;
      return;
    }

    if (upgradeId === "edge_probe") {
      this.edgeProbeDistance += 28;
      this.swallowRadiusBonus += 4;
      return;
    }

    if (upgradeId === "chain_hunt") {
      this.chainHuntAbsorbBonus += 0.16;
      return;
    }

    if (upgradeId === "hazard_skin") {
      this.zoneDamageMultiplier *= 0.72;
      return;
    }

    if (upgradeId === "wide_mouth") {
      this.swallowRadiusBonus += 10;
      this.absorbDamageMultiplier *= 1.06;
      return;
    }

    if (upgradeId === "momentum_harvest") {
      this.momentumHarvestSpeedBonus += 0.16;
      this.killRewardMultiplier *= 1.08;
      return;
    }

    if (upgradeId === "danger_instinct") {
      this.damageTakenMultiplier *= 0.88;
      this.pressureDamageMultiplier *= 0.9;
      this.dangerOverlayBoost += 0.22;
    }
  }

  private triggerChainHunt() {
    if (this.chainHuntAbsorbBonus <= 0) {
      return;
    }

    this.chainHuntTimer = Math.max(this.chainHuntTimer, 5.5);
  }

  private triggerMomentumHarvest() {
    if (this.momentumHarvestSpeedBonus <= 0) {
      return;
    }

    this.momentumHarvestTimer = Math.max(this.momentumHarvestTimer, 4.8);
  }

  private playGainFeedback(position: Vec3, scale = 1, showRing = false) {
    if (showRing && this.gainEffectCooldown <= 0) {
      this.spawnRing(this.playerGainRingPrefab, this.node.position, 0.36, 0.9, 1.65, 96);
      this.gainEffectCooldown = 0.35;
    }

    this.spawnEatParticles(position, scale);
  }

  private playDangerFeedback() {
    if (this.dangerEffectCooldown > 0) {
      return;
    }

    this.spawnRing(this.playerDangerRingPrefab, this.node.position, 0.22, 0.95, 1.35, 42);
    this.dangerEffectCooldown = 0.28;
  }

  private createDangerOverlay() {
    if (this.dangerOverlay?.node?.isValid) {
      return;
    }

    const canvas = director.getScene()?.getChildByName("Canvas");

    if (!canvas) {
      return;
    }

    const overlayNode = new Node("DamageEdgeOverlay");

    overlayNode.setParent(canvas);
    overlayNode.setPosition(0, 0, 0);
    overlayNode.addComponent(UITransform);
    this.dangerOverlay = overlayNode.addComponent(Graphics);
  }

  private updateDangerOverlay(deltaTime: number) {
    if (!this.dangerOverlay) {
      return;
    }

    this.dangerOverlayIntensity = Math.max(
      0,
      this.dangerOverlayIntensity - deltaTime * 1.8,
    );
    this.dangerOverlay.clear();

    if (this.dangerOverlayIntensity <= 0.01) {
      return;
    }

    const visibleSize = view.getVisibleSize();
    const width = visibleSize.width;
    const height = visibleSize.height;
    const intensity = this.dangerOverlayIntensity;
    const minSide = Math.min(width, height);
    const left = -width / 2;
    const bottom = -height / 2;
    const cornerRadius = Math.min(34, minSide * 0.045);

    this.dangerOverlay.fillColor = new Color(
      255,
      35,
      35,
      Math.floor(28 * intensity),
    );
    this.dangerOverlay.rect(left, bottom, width, height);
    this.dangerOverlay.fill();

    const layers = 8;
    const maxInset = minSide * 0.13;

    for (let i = 0; i < layers; i++) {
      const t = i / Math.max(layers - 1, 1);
      const inset = t * maxInset;
      const alpha = Math.floor((95 - t * 72) * intensity);
      const lineWidth = Math.max(5, maxInset / layers * 1.55);

      this.dangerOverlay.lineWidth = lineWidth;
      this.dangerOverlay.strokeColor = new Color(
        255,
        Math.floor(22 + t * 95),
        Math.floor(22 + t * 70),
        alpha,
      );
      this.dangerOverlay.roundRect(
        left + inset,
        bottom + inset,
        width - inset * 2,
        height - inset * 2,
        Math.max(4, cornerRadius - t * 12),
      );
      this.dangerOverlay.stroke();
    }
  }

  private spawnEatParticles(position: Vec3, scale = 1) {
    if (!this.eatParticlePrefab || !this.getEffectRoot()) {
      return;
    }

    const count = Math.max(3, Math.floor(4 * scale));

    for (let i = 0; i < count; i++) {
      const particle = instantiate(this.eatParticlePrefab);
      const angle = Math.random() * Math.PI * 2;
      const distance = 8 + Math.random() * 14 * scale;

      particle.setParent(this.getEffectRoot());
      particle.setPosition(
        position.x + Math.cos(angle) * distance,
        position.y + Math.sin(angle) * distance,
        position.z,
      );
      particle.setScale(scale, scale, 1);
      this.trackEffect(particle, 0.28, scale, 0.15);
    }
  }

  private spawnRing(
    prefab: Prefab | null,
    position: Vec3,
    duration: number,
    startScale: number,
    endScale: number,
    extraSize = 28,
  ) {
    if (!prefab || !this.getEffectRoot()) {
      return;
    }

    const ring = instantiate(prefab);
    const transform = ring.getComponent(UITransform);

    ring.setParent(this.getEffectRoot());
    ring.setPosition(position);

    if (transform) {
      const size = this.getRadius() * 2 + extraSize;

      transform.setContentSize(size, size);
    }

    this.trackEffect(ring, duration, startScale, endScale);
  }

  private trackEffect(node: Node, duration: number, startScale: number, endScale: number) {
    if (!node.getComponent(UIOpacity)) {
      node.addComponent(UIOpacity);
    }

    node.setScale(startScale, startScale, 1);
    this.effects.push({
      node,
      age: 0,
      duration,
      startScale,
      endScale,
    });
  }

  private updateFeedbackEffects(deltaTime: number) {
    this.gainEffectCooldown = Math.max(0, this.gainEffectCooldown - deltaTime);
    this.dangerEffectCooldown = Math.max(0, this.dangerEffectCooldown - deltaTime);

    for (let i = this.effects.length - 1; i >= 0; i--) {
      const effect = this.effects[i];

      if (!effect.node.isValid) {
        this.effects.splice(i, 1);
        continue;
      }

      effect.age += deltaTime;

      const progress = Math.min(effect.age / effect.duration, 1);
      const scale = effect.startScale + (effect.endScale - effect.startScale) * progress;
      const opacity = effect.node.getComponent(UIOpacity);

      effect.node.setScale(scale, scale, 1);

      if (opacity) {
        opacity.opacity = Math.max(0, 255 * (1 - progress));
      }

      if (progress >= 1) {
        effect.node.destroy();
        this.effects.splice(i, 1);
      }
    }
  }

  private getEffectRoot() {
    this.effectRoot = this.effectRoot ?? find("EffectRoot", this.node.parent);

    return this.effectRoot;
  }

  private spawnNewFood() {
    const scene = director.getScene();

    if (!scene) {
      return;
    }

    const gameRoot = scene.getChildByName("Canvas")?.getChildByName("GameRoot");

    if (!gameRoot) {
      return;
    }

    const gameManager = gameRoot.getComponent("GameManager") as any;

    if (!gameManager) {
      return;
    }

    gameManager.spawnOneFood();
  }

  private isGameOver() {
    return this.getGameManager()?.isOver?.() ?? false;
  }

  private isGameActionPaused() {
    return this.getGameManager()?.isActionPaused?.() ?? false;
  }

  private getGameManager() {
    const scene = director.getScene();

    if (!scene) {
      return null;
    }

    const gameRoot = scene.getChildByName("Canvas")?.getChildByName("GameRoot");

    if (!gameRoot) {
      return null;
    }

    const gameManager = gameRoot.getComponent("GameManager") as any;

    if (!gameManager) {
      return null;
    }

    return gameManager;
  }
}
