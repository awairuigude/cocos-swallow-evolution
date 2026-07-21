import {
  _decorator,
  Component,
  Node,
  Prefab,
  instantiate,
  Vec3,
  UITransform,
  Sprite,
  Color,
  Graphics,
  Label,
  Button,
  director,
  view,
} from "cc";

import { PlayerController } from "./PlayerController";
import { EnemyActivity, EnemyController, EnemyMode } from "./EnemyController";

const { ccclass, property } = _decorator;

enum ZonePhase {
  Inactive,
  Cooldown,
  Warning,
  Bombing,
  Resource,
}

type DangerZone = {
  node: Node;
  graphics: Graphics;
  center: Vec3;
  radius: number;
  willBecomeResource: boolean;
  hunterAttract: boolean;
};

type RogueUpgrade = {
  id: string;
  name: string;
  tag: string;
  detail: string;
  maxLevel: number;
};

const ROGUE_UPGRADES: RogueUpgrade[] = [
  {
    id: "jet_core",
    name: "喷射核心",
    tag: "机动",
    detail: "喷射推力提高，最高速度提高。",
    maxLevel: 3,
  },
  {
    id: "efficient_spray",
    name: "节能喷射",
    tag: "机动",
    detail: "喷射消耗降低，乱喷惩罚更晚触发。",
    maxLevel: 3,
  },
  {
    id: "cooling_spray",
    name: "冷却喷口",
    tag: "机动",
    detail: "乱喷惩罚降低，停止喷射后更快恢复。",
    maxLevel: 2,
  },
  {
    id: "hunting_teeth",
    name: "吞噬牙齿",
    tag: "猎杀",
    detail: "吃球造成的吞噬速度提高。",
    maxLevel: 4,
  },
  {
    id: "finish_reward",
    name: "收割奖励",
    tag: "猎杀",
    detail: "完整吃掉球体时获得更多质量。",
    maxLevel: 3,
  },
  {
    id: "resource_stomach",
    name: "资源胃袋",
    tag: "资源",
    detail: "普通食物和黄圈资源提供更多质量。",
    maxLevel: 3,
  },
  {
    id: "natural_recover",
    name: "自然恢复",
    tag: "生存",
    detail: "不喷射时成长更快，惩罚期更短。",
    maxLevel: 3,
  },
  {
    id: "damage_buffer",
    name: "受击缓冲",
    tag: "生存",
    detail: "被大球和危险区吞噬时损失降低。",
    maxLevel: 3,
  },
  {
    id: "edge_probe",
    name: "边界触须",
    tag: "猎杀",
    detail: "可以更深探出边界，边缘球更容易被吃到。",
    maxLevel: 2,
  },
  {
    id: "chain_hunt",
    name: "连锁吞噬",
    tag: "猎杀",
    detail: "完整吃掉球体后，短时间提高吞噬效率。",
    maxLevel: 3,
  },
  {
    id: "hazard_skin",
    name: "灼烧适应",
    tag: "生存",
    detail: "降低危险区伤害，资源争夺更敢冒险。",
    maxLevel: 2,
  },
  {
    id: "resource_compass",
    name: "资源预判",
    tag: "资源",
    detail: "预警期标出会转化为资源区的轰炸圈。",
    maxLevel: 1,
  },
  {
    id: "wide_mouth",
    name: "外圈咬合",
    tag: "猎杀",
    detail: "吞噬判定略微外扩，更适合贴边吃球。",
    maxLevel: 3,
  },
  {
    id: "momentum_harvest",
    name: "收割惯性",
    tag: "机动",
    detail: "完整吃掉球体后，短时间提高最高速度。",
    maxLevel: 2,
  },
  {
    id: "danger_instinct",
    name: "危险直觉",
    tag: "生存",
    detail: "被大球吞噬时损失降低，红屏警示更明显。",
    maxLevel: 2,
  },
];

@ccclass("GameManager")
export class GameManager extends Component {
  @property(Prefab)
  foodPrefab: Prefab | null = null;

  @property(Prefab)
  enemyPrefab: Prefab | null = null;

  @property(Node)
  foodRoot: Node | null = null;

  @property(Node)
  enemyRoot: Node | null = null;

  @property(Node)
  player: Node | null = null;

  @property(Label)
  timeLabel: Label | null = null;

  @property(Label)
  gameOverLabel: Label | null = null;

  @property(Button)
  restartButton: Button | null = null;

  @property
  foodCount = 520;

  @property
  starterFoodCount = 70;

  @property
  starterFoodInnerRadius = 120;

  @property
  starterFoodOuterRadius = 520;

  @property
  starterPreyCount = 14;

  @property
  starterPreyInnerRadius = 240;

  @property
  starterPreyOuterRadius = 660;

  @property
  energyZoneStartTime = 75;

  @property
  energyZoneRadius = 320;

  @property
  bonusFoodCount = 21;

  @property
  bonusFoodSize = 22;

  @property
  energyZoneRingWidth = 6;

  @property
  dangerZoneCount = 3;

  @property
  dangerZoneWarningDuration = 6.5;

  @property
  dangerZoneBombDuration = 11;

  @property
  dangerZoneResourceDuration = 6.5;

  @property
  dangerZoneCooldownDuration = 58;

  @property
  dangerZoneMinRadius = 190;

  @property
  dangerZoneMaxRadius = 420;

  @property
  dangerZoneBaseDamage = 18;

  @property
  dangerZoneGiantDamageMultiplier = 2.5;

  @property
  energyZoneMediumCount = 10;

  @property
  energyZoneGiantCount = 8;

  @property
  energyZoneHunterCount = 2;

  @property
  energyZoneMediumInnerRadius = 180;

  @property
  energyZoneMediumOuterRadius = 360;

  @property
  energyZoneGiantInnerRadius = 360;

  @property
  energyZoneGiantOuterRadius = 760;

  @property
  energyZoneHunterInnerRadius = 260;

  @property
  energyZoneHunterOuterRadius = 560;

  @property
  smallPreyCount = 48;

  @property
  mediumEnemyCount = 34;

  @property
  giantEnemyCount = 42;

  @property
  nativeHunterCount = 1;

  @property
  triggerHunterCount = 5;

  @property
  smallPreyMinMass = 35;

  @property
  smallPreyMaxMass = 120;

  @property
  mediumEnemyMinMass = 180;

  @property
  mediumEnemyMaxMass = 620;

  @property
  giantEnemyMinMass = 1400;

  @property
  giantEnemyMaxMass = 5200;

  @property
  hunterEnemyMinMass = 260;

  @property
  hunterEnemyMaxMass = 760;

  @property
  smallPreySpeed = 18;

  @property
  mediumEnemySpeed = 12;

  @property
  giantEnemySpeed = 5;

  @property
  nativeHunterSpeed = 32;

  @property
  triggerHunterSpeed = 42;

  @property
  smallPreyRewardMass = 18;

  @property
  mediumEnemyRewardMass = 80;

  @property
  giantEnemyRewardMass = 360;

  @property
  hunterEnemyRewardMass = 120;

  @property
  triggerHunterChaseRange = 220;

  @property
  smallPreyAbsorbSpeed = 44;

  @property
  mediumEnemyAbsorbSpeed = 30;

  @property
  giantEnemyAbsorbSpeed = 18;

  @property
  hunterEnemyAbsorbSpeed = 20;

  @property
  mapWidth = 3600;

  @property
  mapHeight = 2400;

  @property
  mapEdgeWarningWidth = 72;

  @property
  minSpawnDistance = 120;

  @property
  enemyMinSpawnDistance = 420;

  @property
  mediumEnemyMinSpawnDistance = 640;

  @property
  giantEnemyMinSpawnDistance = 700;

  @property
  nativeHunterMinSpawnDistance = 1000;

  @property
  gameTime = 300;

  @property
  enemyRestockInterval = 5;

  @property
  upgradeFirstDelay = 35;

  @property
  upgradeInterval = 45;

  @property
  maxUpgradeCount = 6;

  private leftTime = 60;
  private isGameOver = false;
  private isUpgradeOpen = false;
  private isEnergyZoneActive = false;
  private enemyRestockTimer = 0;
  private upgradeTimer = 0;
  private upgradeRound = 0;
  private zonePhase = ZonePhase.Inactive;
  private zonePhaseTimer = 0;
  private hasStartedZoneCycle = false;
  private dangerZones: DangerZone[] = [];
  private enemySortTimer = 0;
  private upgradeOverlay: Node | null = null;
  private mapEdgeWarningNode: Node | null = null;
  private upgradeLevels = new Map<string, number>();
  private hasResourceCompass = false;
  private pressureDirectorTimer = 0;
  private pressureDirectorSpawnCount = 0;

  start() {
    this.leftTime = this.gameTime;
    this.isGameOver = false;
    this.isUpgradeOpen = false;
    this.isEnergyZoneActive = false;
    this.enemyRestockTimer = 0;
    this.upgradeTimer = 0;
    this.upgradeRound = 0;
    this.zonePhase = ZonePhase.Inactive;
    this.zonePhaseTimer = 0;
    this.hasStartedZoneCycle = false;
    this.dangerZones = [];
    this.hasResourceCompass = false;
    this.pressureDirectorTimer = 0;
    this.pressureDirectorSpawnCount = 0;
    this.upgradeLevels.clear();
    this.clearUpgradeOverlay();
    this.createMapEdgeWarning();
    this.updateTimeLabel();

    if (this.gameOverLabel) {
      this.gameOverLabel.node.active = false;
    }

    if (this.restartButton) {
      this.restartButton.node.active = false;
      this.restartButton.node.on(
        Button.EventType.CLICK,
        this.restartGame,
        this,
      );
    }

    this.spawnStarterArea();
    this.spawnFoods();
    this.spawnEnemies();
  }

  update(deltaTime: number) {
    if (this.isGameOver) {
      return;
    }

    if (this.isUpgradeOpen) {
      this.updateTimeLabel();
      return;
    }

    this.leftTime -= deltaTime;

    this.updateZonePhase(deltaTime);
    this.updateRogueUpgradeTimer(deltaTime);

    if (this.leftTime <= 0) {
      this.leftTime = 0;
      this.endGame();
    }

    this.updateTimeLabel();
    this.updateEnemyRestock(deltaTime);
    this.updatePressureDirector(deltaTime);
    this.updateEnemyRenderOrder(deltaTime);
  }

  spawnOneFood() {
    if (!this.foodPrefab || !this.foodRoot || this.isGameOver) {
      return;
    }

    const position = this.getRandomFoodPosition();

    if (!position) {
      return;
    }

    const food = instantiate(this.foodPrefab);
    food.setPosition(position);
    food.setParent(this.foodRoot);
  }

  isOver() {
    return this.isGameOver;
  }

  isActionPaused() {
    return this.isGameOver || this.isUpgradeOpen;
  }

  forceGameOver() {
    if (this.isGameOver) {
      return;
    }

    this.leftTime = 0;
    this.endGame();
  }

  private spawnFoods() {
    for (let i = 0; i < this.foodCount; i++) {
      this.spawnOneFood();
    }
  }

  private updateRogueUpgradeTimer(deltaTime: number) {
    if (this.upgradeRound >= this.maxUpgradeCount) {
      return;
    }

    this.upgradeTimer += deltaTime;

    const targetTime = this.upgradeRound === 0
      ? this.upgradeFirstDelay
      : this.upgradeInterval;

    if (this.upgradeTimer < targetTime) {
      return;
    }

    this.upgradeTimer = 0;
    this.showUpgradeSelection();
  }

  private showUpgradeSelection() {
    const options = this.pickUpgradeOptions(3);

    if (options.length === 0) {
      return;
    }

    const canvas = director.getScene()?.getChildByName("Canvas");

    if (!canvas) {
      return;
    }

    this.isUpgradeOpen = true;
    this.clearUpgradeOverlay();

    const visibleSize = view.getVisibleSize();
    const overlay = new Node("RogueUpgradeOverlay");
    const overlayTransform = overlay.addComponent(UITransform);
    const overlayGraphics = overlay.addComponent(Graphics);

    overlay.setParent(canvas);
    overlay.setPosition(0, 0, 0);
    overlayTransform.setContentSize(visibleSize.width, visibleSize.height);
    overlayGraphics.fillColor = new Color(8, 10, 16, 185);
    overlayGraphics.rect(
      -visibleSize.width / 2,
      -visibleSize.height / 2,
      visibleSize.width,
      visibleSize.height,
    );
    overlayGraphics.fill();

    const panelWidth = Math.min(860, visibleSize.width - 64);
    const panelHeight = Math.min(390, visibleSize.height - 60);
    const panel = this.createRectNode(
      overlay,
      "UpgradePanel",
      0,
      0,
      panelWidth,
      panelHeight,
      new Color(20, 24, 34, 245),
      new Color(115, 145, 185, 170),
    );

    this.createTextNode(
      panel,
      "UpgradeTitle",
      "选择一次局内强化",
      0,
      panelHeight / 2 - 50,
      26,
      new Color(245, 248, 255, 255),
      panelWidth - 60,
      40,
    );
    this.createTextNode(
      panel,
      "UpgradeTip",
      `第 ${this.upgradeRound + 1} 次强化，当前会暂停局内行动`,
      0,
      panelHeight / 2 - 88,
      16,
      new Color(175, 190, 210, 255),
      panelWidth - 60,
      30,
    );

    const cardWidth = Math.min(250, (panelWidth - 96) / 3);
    const cardHeight = 210;
    const totalWidth = cardWidth * options.length + 24 * (options.length - 1);
    const startX = -totalWidth / 2 + cardWidth / 2;

    options.forEach((upgrade, index) => {
      const level = (this.upgradeLevels.get(upgrade.id) ?? 0) + 1;
      const x = startX + index * (cardWidth + 24);
      const card = this.createUpgradeCard(
        panel,
        upgrade,
        level,
        x,
        -36,
        cardWidth,
        cardHeight,
      );

      card.on(Button.EventType.CLICK, () => {
        this.chooseUpgrade(upgrade);
      }, this);
    });

    this.upgradeOverlay = overlay;
  }

  private createUpgradeCard(
    parent: Node,
    upgrade: RogueUpgrade,
    level: number,
    x: number,
    y: number,
    width: number,
    height: number,
  ) {
    const card = this.createRectNode(
      parent,
      `Upgrade_${upgrade.id}`,
      x,
      y,
      width,
      height,
      new Color(31, 38, 52, 255),
      new Color(116, 166, 220, 155),
    );

    card.addComponent(Button);

    this.createTextNode(
      card,
      "Tag",
      upgrade.tag,
      0,
      height / 2 - 34,
      15,
      this.getUpgradeTagColor(upgrade.tag),
      width - 32,
      24,
    );
    this.createTextNode(
      card,
      "Name",
      upgrade.name,
      0,
      height / 2 - 72,
      22,
      new Color(245, 248, 255, 255),
      width - 32,
      34,
    );
    this.createTextNode(
      card,
      "Detail",
      upgrade.detail,
      0,
      8,
      17,
      new Color(205, 216, 230, 255),
      width - 38,
      76,
    );
    this.createTextNode(
      card,
      "Level",
      `等级 ${level}/${upgrade.maxLevel}`,
      0,
      -height / 2 + 30,
      15,
      new Color(155, 178, 205, 255),
      width - 32,
      24,
    );

    return card;
  }

  private createRectNode(
    parent: Node,
    name: string,
    x: number,
    y: number,
    width: number,
    height: number,
    fill: Color,
    stroke: Color,
  ) {
    const node = new Node(name);
    const transform = node.addComponent(UITransform);
    const graphics = node.addComponent(Graphics);

    node.setParent(parent);
    node.setPosition(x, y, 0);
    transform.setContentSize(width, height);
    graphics.fillColor = fill;
    graphics.roundRect(-width / 2, -height / 2, width, height, 8);
    graphics.fill();
    graphics.lineWidth = 2;
    graphics.strokeColor = stroke;
    graphics.roundRect(-width / 2, -height / 2, width, height, 8);
    graphics.stroke();

    return node;
  }

  private createTextNode(
    parent: Node,
    name: string,
    text: string,
    x: number,
    y: number,
    fontSize: number,
    color: Color,
    width: number,
    height: number,
  ) {
    const node = new Node(name);
    const transform = node.addComponent(UITransform);
    const label = node.addComponent(Label);

    node.setParent(parent);
    node.setPosition(x, y, 0);
    transform.setContentSize(width, height);
    label.string = text;
    label.fontSize = fontSize;
    label.lineHeight = fontSize + 8;
    label.color = color;
    label.enableWrapText = true;
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;

    return node;
  }

  private chooseUpgrade(upgrade: RogueUpgrade) {
    const playerController = this.player?.getComponent(PlayerController);

    playerController?.applyRogueUpgrade(upgrade.id);
    if (upgrade.id === "resource_compass") {
      this.hasResourceCompass = true;
    }
    this.upgradeLevels.set(
      upgrade.id,
      (this.upgradeLevels.get(upgrade.id) ?? 0) + 1,
    );
    this.upgradeRound += 1;
    this.isUpgradeOpen = false;
    this.clearUpgradeOverlay();
    this.updateTimeLabel();
  }

  private pickUpgradeOptions(count: number) {
    const pool = ROGUE_UPGRADES.filter((upgrade) => {
      return (this.upgradeLevels.get(upgrade.id) ?? 0) < upgrade.maxLevel;
    });

    const picked: RogueUpgrade[] = [];
    const usedTags = new Set<string>();

    for (let i = pool.length - 1; i > 0; i--) {
      const swapIndex = Math.floor(Math.random() * (i + 1));
      const temp = pool[i];

      pool[i] = pool[swapIndex];
      pool[swapIndex] = temp;
    }

    for (const upgrade of pool) {
      if (picked.length >= count) {
        break;
      }

      if (usedTags.has(upgrade.tag)) {
        continue;
      }

      picked.push(upgrade);
      usedTags.add(upgrade.tag);
    }

    for (const upgrade of pool) {
      if (picked.length >= count) {
        break;
      }

      if (picked.indexOf(upgrade) >= 0) {
        continue;
      }

      picked.push(upgrade);
    }

    return picked;
  }

  private clearUpgradeOverlay() {
    if (this.upgradeOverlay?.isValid) {
      this.upgradeOverlay.destroy();
    }

    this.upgradeOverlay = null;
  }

  private getUpgradeTagColor(tag: string) {
    if (tag === "机动") {
      return new Color(115, 210, 255, 255);
    }

    if (tag === "猎杀") {
      return new Color(255, 135, 105, 255);
    }

    if (tag === "资源") {
      return new Color(255, 220, 105, 255);
    }

    return new Color(145, 235, 165, 255);
  }

  private spawnStarterArea() {
    for (let i = 0; i < this.starterFoodCount; i++) {
      this.spawnFoodAt(
        this.getRandomStarterPosition(
          this.starterFoodInnerRadius,
          this.starterFoodOuterRadius,
        ),
      );
    }

    for (let i = 0; i < this.starterPreyCount; i++) {
      this.spawnOneEnemyAt(
        EnemyMode.Drift,
        "smallPrey",
        this.getRandomStarterPosition(
          this.starterPreyInnerRadius,
          this.starterPreyOuterRadius,
        ),
      );
    }
  }

  private spawnEnemies() {
    for (let i = 0; i < this.smallPreyCount; i++) {
      this.spawnOneEnemy(EnemyMode.Drift, "smallPrey");
    }

    for (let i = 0; i < this.mediumEnemyCount; i++) {
      this.spawnOneEnemy(EnemyMode.Drift, "medium");
    }

    for (let i = 0; i < this.giantEnemyCount; i++) {
      this.spawnOneEnemy(EnemyMode.Drift, "giant");
    }

    for (let i = 0; i < this.nativeHunterCount; i++) {
      this.spawnOneEnemy(EnemyMode.NativeChase, "nativeHunter");
    }

    for (let i = 0; i < this.triggerHunterCount; i++) {
      this.spawnOneEnemy(EnemyMode.Chase, "triggerHunter");
    }
  }

  private createMapEdgeWarning() {
    if (this.mapEdgeWarningNode?.isValid) {
      this.mapEdgeWarningNode.destroy();
    }

    const node = new Node("MapEdgeWarning");
    const transform = node.addComponent(UITransform);
    const graphics = node.addComponent(Graphics);
    const width = this.mapEdgeWarningWidth;

    node.setParent(this.node);
    node.setPosition(0, 0, 0);
    node.setSiblingIndex(0);
    transform.setContentSize(this.mapWidth + width * 2, this.mapHeight + width * 2);

    graphics.lineWidth = width;
    graphics.strokeColor = new Color(255, 35, 35, 34);
    graphics.rect(-this.mapWidth / 2, -this.mapHeight / 2, this.mapWidth, this.mapHeight);
    graphics.stroke();

    graphics.lineWidth = 4;
    graphics.strokeColor = new Color(255, 70, 55, 115);
    graphics.rect(-this.mapWidth / 2, -this.mapHeight / 2, this.mapWidth, this.mapHeight);
    graphics.stroke();

    this.mapEdgeWarningNode = node;
  }

  private activateEnergyZone() {
    this.isEnergyZoneActive = true;
    this.hasStartedZoneCycle = true;
    this.zonePhase = ZonePhase.Warning;
    this.zonePhaseTimer = 0;
    this.createDangerZones();
  }

  private updateZonePhase(deltaTime: number) {
    if (!this.hasStartedZoneCycle && this.leftTime <= this.gameTime - this.energyZoneStartTime) {
      this.activateEnergyZone();
    }

    if (this.zonePhase === ZonePhase.Inactive) {
      return;
    }

    this.zonePhaseTimer += deltaTime;

    if (this.zonePhase === ZonePhase.Cooldown) {
      if (this.zonePhaseTimer >= this.dangerZoneCooldownDuration) {
        this.zonePhase = ZonePhase.Warning;
        this.zonePhaseTimer = 0;
        this.createDangerZones();
      }

      return;
    }

    if (this.zonePhase === ZonePhase.Warning) {
      this.updateDangerZoneVisuals(this.zonePhaseTimer / this.dangerZoneWarningDuration, false);
      this.updateDangerZoneEnemyIntent(deltaTime, false);

      if (this.zonePhaseTimer >= this.dangerZoneWarningDuration) {
        this.zonePhase = ZonePhase.Bombing;
        this.zonePhaseTimer = 0;
      }

      return;
    }

    if (this.zonePhase === ZonePhase.Bombing) {
      this.updateDangerZoneVisuals(1, true);
      this.applyDangerZoneDamage(deltaTime);
      this.updateDangerZoneEnemyIntent(deltaTime, true);

      if (this.zonePhaseTimer >= this.dangerZoneBombDuration) {
        this.zonePhase = ZonePhase.Resource;
        this.zonePhaseTimer = 0;
        this.convertDangerZonesToResources();
      }

      return;
    }

    this.updateResourceZoneVisuals();
    this.updateResourceZoneEnemyIntent(deltaTime);

    if (this.zonePhaseTimer >= this.dangerZoneResourceDuration) {
      this.clearDangerZones();
      this.zonePhase = ZonePhase.Cooldown;
      this.zonePhaseTimer = 0;
    }
  }

  private createDangerZones() {
    this.clearDangerZones();
    this.dangerZones = [];

    const resourceCount = Math.max(1, Math.ceil(this.dangerZoneCount * 0.5));

    for (let i = 0; i < this.dangerZoneCount; i++) {
      const node = new Node(`DangerZone_${i + 1}`);
      const radius = this.randomRange(this.dangerZoneMinRadius, this.dangerZoneMaxRadius);
      const center = this.getRandomDangerZonePosition(i, radius);

      node.setParent(this.node);
      node.setPosition(center);
      node.addComponent(UITransform);

      const graphics = node.addComponent(Graphics);

      this.dangerZones.push({
        node,
        graphics,
        center,
        radius,
        willBecomeResource: i < resourceCount,
        hunterAttract: i < resourceCount,
      });
    }
  }

  private clearDangerZones() {
    for (const zone of this.dangerZones) {
      if (zone.node.isValid) {
        zone.node.destroy();
      }
    }

    this.dangerZones = [];
  }

  private updateDangerZoneVisuals(progress: number, active: boolean) {
    const fillProgress = Math.min(Math.max(progress, 0), 1);
    const pulse = 0.65 + Math.sin(this.zonePhaseTimer * 7) * 0.25;

    for (const zone of this.dangerZones) {
      const graphics = zone.graphics;
      const fillAlpha = Math.floor((active ? 95 : 58) * (0.35 + fillProgress * 0.65));
      const lineAlpha = Math.floor((active ? 230 : 170) * (0.7 + pulse * 0.3));

      graphics.clear();
      graphics.fillColor = active
        ? new Color(255, 55, 25, fillAlpha)
        : new Color(255, 120, 30, fillAlpha);
      graphics.circle(0, 0, zone.radius * fillProgress);
      graphics.fill();

      graphics.lineWidth = this.energyZoneRingWidth;
      graphics.strokeColor = active
        ? new Color(255, 35, 25, lineAlpha)
        : new Color(255, 150, 55, lineAlpha);
      graphics.circle(0, 0, zone.radius);
      graphics.stroke();

      graphics.lineWidth = 2;
      graphics.strokeColor = active
        ? new Color(255, 210, 90, 100)
        : new Color(255, 210, 90, 75);

      for (let i = 0; i < 7; i++) {
        const angle = (Math.PI * 2 * i) / 7 + this.zonePhaseTimer * 0.5;
        const distance = zone.radius * (0.28 + (i % 3) * 0.16);
        const x = Math.cos(angle) * distance;
        const y = Math.sin(angle) * distance;

        graphics.circle(x, y, zone.radius * 0.055);
      }

      graphics.stroke();

      if (!active && this.hasResourceCompass && zone.willBecomeResource) {
        graphics.fillColor = new Color(255, 225, 75, 75 + Math.floor(fillProgress * 70));
        graphics.circle(0, 0, Math.max(18, zone.radius * 0.1));
        graphics.fill();
        graphics.lineWidth = 3;
        graphics.strokeColor = new Color(255, 238, 120, 140);
        graphics.circle(0, 0, Math.max(24, zone.radius * 0.16));
        graphics.stroke();
      }
    }
  }

  private updateDangerZoneEnemyIntent(deltaTime: number, active: boolean) {
    if (!this.enemyRoot) {
      return;
    }

    let giantIndex = 0;

    for (const enemy of this.enemyRoot.children) {
      const controller = enemy.getComponent(EnemyController);

      if (!controller) {
        continue;
      }

      const isGiant = enemy.name === this.getEnemyName("giant");
      const attractedGiant = isGiant && giantIndex % 3 === 0;

      if (isGiant) {
        giantIndex += 1;
      }

      if (attractedGiant) {
        const targetZone = this.findNearestResourceDangerZone(enemy.position);

        if (targetZone) {
          controller.seekZone(targetZone.center, deltaTime, active ? 0.45 : 0.32);
        }

        continue;
      }

      for (const zone of this.dangerZones) {
        const threatRadius = zone.radius + (active ? 160 : 90);

        controller.applyZoneThreat(zone.center, threatRadius, deltaTime, active ? 1 : 0.45);
      }
    }
  }

  private applyDangerZoneDamage(deltaTime: number) {
    const playerController = this.player?.getComponent(PlayerController);

    for (const zone of this.dangerZones) {
      if (this.player && playerController) {
        const playerDistance = Vec3.distance(this.player.position, zone.center);

        if (playerDistance <= zone.radius) {
          const damageRatio = 1 - playerDistance / zone.radius;
          const damage = this.dangerZoneBaseDamage * (0.35 + damageRatio) * deltaTime;

          playerController.loseMass(damage, 0.65 + damageRatio * 0.35, "zone");

          if (playerController.getMass() <= 20) {
            this.forceGameOver();
          }
        }
      }

      if (!this.enemyRoot) {
        continue;
      }

      let giantIndex = 0;

      for (const enemy of [...this.enemyRoot.children]) {
        if (!enemy.isValid) {
          continue;
        }

        const controller = enemy.getComponent(EnemyController);

        if (!controller) {
          continue;
        }

        const isGiant = enemy.name === this.getEnemyName("giant");
        const attractedGiant = isGiant && giantIndex % 3 === 0;

        if (isGiant) {
          giantIndex += 1;
        }

        if (attractedGiant) {
          continue;
        }

        const distance = Vec3.distance(enemy.position, zone.center);

        if (distance > zone.radius) {
          continue;
        }

        const damageRatio = 1 - distance / zone.radius;
        const multiplier = isGiant ? this.dangerZoneGiantDamageMultiplier : 1;
        const damage =
          this.dangerZoneBaseDamage *
          multiplier *
          (0.35 + damageRatio) *
          deltaTime;

        controller.applyZoneDamage(damage);
      }
    }
  }

  private convertDangerZonesToResources() {
    const resourceZones = this.dangerZones.filter((zone) => zone.willBecomeResource);
    const foodPerZone = Math.max(5, Math.ceil(this.bonusFoodCount / Math.max(resourceZones.length, 1)));

    for (const zone of this.dangerZones) {
      const graphics = zone.graphics;

      graphics.clear();

      if (!zone.willBecomeResource) {
        if (zone.node.isValid) {
          zone.node.destroy();
        }

        continue;
      }

      zone.node.name = "ResourceZone";
      graphics.fillColor = new Color(255, 220, 80, 30);
      graphics.circle(0, 0, zone.radius);
      graphics.fill();
      graphics.lineWidth = this.energyZoneRingWidth;
      graphics.strokeColor = new Color(255, 220, 70, 190);
      graphics.circle(0, 0, zone.radius);
      graphics.stroke();

      for (let i = 0; i < foodPerZone; i++) {
        this.spawnBonusFoodAt(this.getRandomPositionInZone(zone.center, zone.radius * 0.82));
      }
    }

    this.dangerZones = resourceZones;
  }

  private updateResourceZoneVisuals() {
    const pulse = 0.55 + Math.sin(this.zonePhaseTimer * 3.5) * 0.18;

    for (const zone of this.dangerZones) {
      if (!zone.node.isValid) {
        continue;
      }

      const graphics = zone.graphics;

      graphics.clear();
      graphics.fillColor = new Color(255, 220, 80, Math.floor(32 + pulse * 18));
      graphics.circle(0, 0, zone.radius);
      graphics.fill();
      graphics.lineWidth = this.energyZoneRingWidth;
      graphics.strokeColor = new Color(255, 220, 70, Math.floor(160 + pulse * 60));
      graphics.circle(0, 0, zone.radius);
      graphics.stroke();
    }
  }

  private updateResourceZoneEnemyIntent(deltaTime: number) {
    if (!this.enemyRoot) {
      return;
    }

    for (const enemy of this.enemyRoot.children) {
      const controller = enemy.getComponent(EnemyController);

      if (!controller) {
        continue;
      }

      const nearestZone = this.findNearestResourceDangerZone(enemy.position);

      if (!nearestZone) {
        continue;
      }

      const distance = Vec3.distance(enemy.position, nearestZone.center);

      if (distance <= nearestZone.radius + 360) {
        controller.seekZone(nearestZone.center, deltaTime, 0.2);
      }
    }
  }

  private findNearestResourceDangerZone(position: Vec3) {
    let nearest: DangerZone | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;

    for (const zone of this.dangerZones) {
      if (!zone.willBecomeResource || !zone.node.isValid) {
        continue;
      }

      const distance = Vec3.distance(position, zone.center);

      if (distance < nearestDistance) {
        nearest = zone;
        nearestDistance = distance;
      }
    }

    return nearest;
  }

  private spawnEnergyZoneHazards() {
    this.spawnEnergyZoneEnemies(
      EnemyMode.Drift,
      "medium",
      this.energyZoneMediumCount,
      this.energyZoneMediumInnerRadius,
      this.energyZoneMediumOuterRadius,
      this.enemyMinSpawnDistance,
    );

    this.spawnEnergyZoneEnemies(
      EnemyMode.Drift,
      "giant",
      this.energyZoneGiantCount,
      this.energyZoneGiantInnerRadius,
      this.energyZoneGiantOuterRadius,
      this.giantEnemyMinSpawnDistance,
    );

    this.spawnEnergyZoneEnemies(
      EnemyMode.Chase,
      "triggerHunter",
      this.energyZoneHunterCount,
      this.energyZoneHunterInnerRadius,
      this.energyZoneHunterOuterRadius,
      this.enemyMinSpawnDistance,
    );
  }

  private spawnEnergyZoneEnemies(
    mode: EnemyMode,
    kind: string,
    count: number,
    innerRadius: number,
    outerRadius: number,
    minPlayerDistance: number,
  ) {
    for (let i = 0; i < count; i++) {
      const position = this.getRandomEnergyZoneHazardPosition(
        innerRadius,
        outerRadius,
        minPlayerDistance,
      );

      if (position) {
        this.spawnOneEnemyAt(mode, kind, position);
      }
    }
  }

  private spawnOneBonusFood() {
    if (!this.foodPrefab || !this.foodRoot || this.isGameOver) {
      return;
    }

    const position = this.getRandomEnergyZonePosition();

    this.spawnBonusFoodAt(position);
  }

  private spawnBonusFoodAt(position: Vec3) {
    if (!this.foodPrefab || !this.foodRoot || this.isGameOver) {
      return;
    }

    const food = instantiate(this.foodPrefab);

    food.name = "BonusFood";
    food.setPosition(position);
    food.setParent(this.foodRoot);

    const transform = food.getComponent(UITransform);
    const sprite = food.getComponent(Sprite);

    if (transform) {
      transform.setContentSize(this.bonusFoodSize, this.bonusFoodSize);
    }

    if (sprite) {
      sprite.color = new Color(255, 220, 70, 255);
    }
  }

  private getRandomDangerZonePosition(index: number, radius: number) {
    const baseAngle = (Math.PI * 2 * index) / Math.max(this.dangerZoneCount, 1);
    const angle = baseAngle + this.randomRange(-0.42, 0.42);
    const maxDistance = Math.min(this.mapWidth, this.mapHeight) * 0.34;
    const minDistance = index === 0 ? 0 : Math.min(this.mapWidth, this.mapHeight) * 0.16;
    const distance = index === 0
      ? this.randomRange(0, 160)
      : this.randomRange(minDistance, maxDistance);
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance;

    return new Vec3(
      Math.min(Math.max(x, -this.mapWidth / 2 + radius), this.mapWidth / 2 - radius),
      Math.min(Math.max(y, -this.mapHeight / 2 + radius), this.mapHeight / 2 - radius),
      0,
    );
  }

  private getRandomPositionInZone(center: Vec3, radius: number) {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.sqrt(Math.random()) * radius;

    return new Vec3(
      center.x + Math.cos(angle) * distance,
      center.y + Math.sin(angle) * distance,
      0,
    );
  }

  private spawnOneEnemy(mode: EnemyMode, kind: string) {
    if (!this.enemyPrefab || !this.enemyRoot || this.isGameOver) {
      return;
    }

    const position = this.getRandomEnemyPosition(
      kind === "nativeHunter"
        ? this.nativeHunterMinSpawnDistance
        : kind === "triggerHunter"
          ? this.enemyMinSpawnDistance
          : kind === "medium"
            ? this.mediumEnemyMinSpawnDistance
          : kind === "giant"
            ? this.giantEnemyMinSpawnDistance
            : this.minSpawnDistance,
    );

    if (!position) {
      return;
    }

    this.spawnOneEnemyAt(mode, kind, position);
  }

  private spawnOneEnemyAt(mode: EnemyMode, kind: string, position: Vec3) {
    if (!this.enemyPrefab || !this.enemyRoot || this.isGameOver) {
      return;
    }

    const enemy = instantiate(this.enemyPrefab);
    enemy.name = this.getEnemyName(kind);
    enemy.setPosition(position);
    enemy.setParent(this.enemyRoot);

    const enemyController = enemy.getComponent(EnemyController);

    if (enemyController) {
      const config = this.getEnemyConfig(kind);

      enemyController.mode = mode;
      enemyController.mass = this.getSpawnMass(kind, config.minMass, config.maxMass);
      const isActiveGrower = Math.random() < config.activeGrowerChance;

      enemyController.moveSpeed = config.speed;
      enemyController.rewardMass = config.rewardMass;
      enemyController.absorbSpeed = config.absorbSpeed;
      enemyController.activity = isActiveGrower
        ? EnemyActivity.ActiveGrower
        : EnemyActivity.Sluggish;
      enemyController.canForage = config.canForage;
      enemyController.foodSenseRange = config.foodSenseRange;
      enemyController.activeFoodSenseRange = config.activeFoodSenseRange;
      enemyController.foodSteerSpeed = config.foodSteerSpeed;
      enemyController.escapeStartLossRatio = config.escapeStartLossRatio;
      enemyController.escapeStopDistance = config.escapeStopDistance;
      enemyController.escapeMaxSpeedMultiplier = config.escapeMaxSpeedMultiplier;
      enemyController.alertAvoidRadius = config.alertAvoidRadius;
      enemyController.absorbedEscapeSpeed = config.absorbedEscapeSpeed;
      enemyController.chaseGiveUpTime = config.chaseGiveUpTime;
      enemyController.chaseStopPlayerMassRatio = config.chaseStopPlayerMassRatio;
      enemyController.chaseRange = this.triggerHunterChaseRange;
      enemyController.mapWidth = this.mapWidth;
      enemyController.mapHeight = this.mapHeight;
      enemyController.refreshSize();
    }
  }

  private getEnemyConfig(kind: string) {
    if (kind === "smallPrey") {
      return {
        minMass: this.smallPreyMinMass,
        maxMass: this.smallPreyMaxMass,
        speed: this.smallPreySpeed,
        rewardMass: this.smallPreyRewardMass,
        absorbSpeed: this.smallPreyAbsorbSpeed,
        activeGrowerChance: 0.32,
        canForage: true,
        foodSenseRange: 180,
        activeFoodSenseRange: 980,
        foodSteerSpeed: 4.15,
        escapeStartLossRatio: 0.68,
        escapeStopDistance: 270,
        escapeMaxSpeedMultiplier: 2.35,
        alertAvoidRadius: 120,
        absorbedEscapeSpeed: 155,
        chaseGiveUpTime: 8,
        chaseStopPlayerMassRatio: 1,
      };
    }

    if (kind === "medium") {
      return {
        minMass: this.mediumEnemyMinMass,
        maxMass: this.mediumEnemyMaxMass,
        speed: this.mediumEnemySpeed,
        rewardMass: this.mediumEnemyRewardMass,
        absorbSpeed: this.mediumEnemyAbsorbSpeed,
        activeGrowerChance: 0.46,
        canForage: true,
        foodSenseRange: 240,
        activeFoodSenseRange: 1160,
        foodSteerSpeed: 4.45,
        escapeStartLossRatio: 0.7,
        escapeStopDistance: 330,
        escapeMaxSpeedMultiplier: 2.4,
        alertAvoidRadius: 145,
        absorbedEscapeSpeed: 165,
        chaseGiveUpTime: 8,
        chaseStopPlayerMassRatio: 1,
      };
    }

    if (kind === "nativeHunter") {
      return {
        minMass: this.hunterEnemyMinMass,
        maxMass: this.hunterEnemyMaxMass,
        speed: this.nativeHunterSpeed,
        rewardMass: this.hunterEnemyRewardMass,
        absorbSpeed: this.hunterEnemyAbsorbSpeed,
        activeGrowerChance: 0,
        canForage: false,
        foodSenseRange: 0,
        activeFoodSenseRange: 0,
        foodSteerSpeed: 0,
        escapeStartLossRatio: 0.66,
        escapeStopDistance: 330,
        escapeMaxSpeedMultiplier: 2.2,
        alertAvoidRadius: 120,
        absorbedEscapeSpeed: 145,
        chaseGiveUpTime: 8,
        chaseStopPlayerMassRatio: 1,
      };
    }

    if (kind === "triggerHunter") {
      return {
        minMass: this.hunterEnemyMinMass,
        maxMass: this.hunterEnemyMaxMass,
        speed: this.triggerHunterSpeed,
        rewardMass: this.hunterEnemyRewardMass,
        absorbSpeed: this.hunterEnemyAbsorbSpeed,
        activeGrowerChance: 0,
        canForage: false,
        foodSenseRange: 0,
        activeFoodSenseRange: 0,
        foodSteerSpeed: 0,
        escapeStartLossRatio: 0.66,
        escapeStopDistance: 330,
        escapeMaxSpeedMultiplier: 2.2,
        alertAvoidRadius: 120,
        absorbedEscapeSpeed: 145,
        chaseGiveUpTime: 8,
        chaseStopPlayerMassRatio: 1,
      };
    }

    return {
      minMass: this.giantEnemyMinMass,
      maxMass: this.giantEnemyMaxMass,
      speed: this.giantEnemySpeed,
      rewardMass: this.giantEnemyRewardMass,
      absorbSpeed: this.giantEnemyAbsorbSpeed,
      activeGrowerChance: 0,
      canForage: false,
      foodSenseRange: 0,
      activeFoodSenseRange: 0,
      foodSteerSpeed: 0,
      escapeStartLossRatio: 0.62,
      escapeStopDistance: 360,
      escapeMaxSpeedMultiplier: 1.8,
      alertAvoidRadius: 0,
      absorbedEscapeSpeed: 95,
      chaseGiveUpTime: 8,
      chaseStopPlayerMassRatio: 1,
    };
  }

  private randomRange(min: number, max: number) {
    return min + Math.random() * (max - min);
  }

  private getSpawnMass(kind: string, minMass: number, maxMass: number) {
    if (kind !== "nativeHunter" && kind !== "triggerHunter") {
      return this.randomRange(minMass, maxMass);
    }

    const playerMass = this.player?.getComponent(PlayerController)?.getMass?.() ?? 180;

    if (Math.random() < 0.68) {
      return this.randomRange(playerMass * 1.12, playerMass * 1.62);
    }

    return this.randomRange(minMass, Math.max(maxMass, playerMass * 1.05));
  }

  private updateEnemyRestock(deltaTime: number) {
    this.enemyRestockTimer += deltaTime;

    if (this.enemyRestockTimer < this.enemyRestockInterval) {
      return;
    }

    this.enemyRestockTimer = 0;
    this.restockEnemyKind(EnemyMode.Drift, "smallPrey", this.smallPreyCount, 8);
    this.restockEnemyKind(EnemyMode.Drift, "medium", this.mediumEnemyCount, 5);
    this.restockEnemyKind(EnemyMode.Drift, "giant", this.giantEnemyCount, 3);
    this.restockEnemyKind(EnemyMode.NativeChase, "nativeHunter", this.nativeHunterCount, 1);
    this.restockEnemyKind(EnemyMode.Chase, "triggerHunter", this.triggerHunterCount, 1);
  }

  private updatePressureDirector(deltaTime: number) {
    const elapsedTime = this.gameTime - this.leftTime;

    if (elapsedTime < 55 || !this.player?.isValid) {
      return;
    }

    this.pressureDirectorTimer += deltaTime;

    const interval = Math.max(10, 25 - elapsedTime / 18);

    if (this.pressureDirectorTimer < interval) {
      return;
    }

    this.pressureDirectorTimer = 0;
    this.pressureDirectorSpawnCount += 1;

    const triggerLimit = this.triggerHunterCount + Math.min(8, 2 + Math.floor(elapsedTime / 55));
    const mediumLimit = this.mediumEnemyCount + Math.min(10, 2 + Math.floor(elapsedTime / 65));
    const giantLimit = this.giantEnemyCount + Math.min(8, 1 + Math.floor(elapsedTime / 80));

    if (this.countEnemies("triggerHunter") < triggerLimit) {
      this.spawnPressureEnemy(EnemyMode.Chase, "triggerHunter", 760, 1180);
    }

    if (elapsedTime >= 90 && this.countEnemies("medium") < mediumLimit) {
      this.spawnPressureEnemy(EnemyMode.Drift, "medium", 620, 980);
    }

    if (
      elapsedTime >= 125 &&
      this.countEnemies("giant") < giantLimit &&
      Math.random() < 0.76
    ) {
      this.spawnPressureEnemy(EnemyMode.Drift, "giant", 820, 1280);
    }

    if (
      elapsedTime >= 170 &&
      this.countEnemies("triggerHunter") < triggerLimit + 2 &&
      Math.random() < 0.52
    ) {
      this.spawnPressureEnemy(EnemyMode.Chase, "triggerHunter", 680, 1080);
    }

    if (
      elapsedTime >= 220 &&
      this.pressureDirectorSpawnCount % 2 === 0 &&
      this.countEnemies("giant") < giantLimit + 2
    ) {
      this.spawnPressureEnemy(EnemyMode.Drift, "giant", 720, 1120);
    }
  }

  private spawnPressureEnemy(
    mode: EnemyMode,
    kind: string,
    innerRadius: number,
    outerRadius: number,
  ) {
    const position = this.getPressureSpawnPosition(innerRadius, outerRadius);

    if (!position) {
      return;
    }

    this.spawnOneEnemyAt(mode, kind, position);
  }

  private getPressureSpawnPosition(innerRadius: number, outerRadius: number): Vec3 | null {
    if (!this.player?.isValid) {
      return null;
    }

    const playerPosition = this.player.position;
    const margin = 90;

    for (let i = 0; i < 70; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = innerRadius + Math.random() * (outerRadius - innerRadius);
      const x = playerPosition.x + Math.cos(angle) * distance;
      const y = playerPosition.y + Math.sin(angle) * distance;
      const position = new Vec3(
        Math.min(Math.max(x, -this.mapWidth / 2 + margin), this.mapWidth / 2 - margin),
        Math.min(Math.max(y, -this.mapHeight / 2 + margin), this.mapHeight / 2 - margin),
        0,
      );

      if (this.isPositionSafe(position, innerRadius * 0.72)) {
        return position;
      }
    }

    return null;
  }

  private updateEnemyRenderOrder(deltaTime: number) {
    if (!this.enemyRoot) {
      return;
    }

    this.enemySortTimer += deltaTime;

    if (this.enemySortTimer < 0.2) {
      return;
    }

    this.enemySortTimer = 0;

    const sortedEnemies = [...this.enemyRoot.children].sort((a, b) => {
      const aMass = a.getComponent(EnemyController)?.getMassValue() ?? 0;
      const bMass = b.getComponent(EnemyController)?.getMassValue() ?? 0;

      return bMass - aMass;
    });

    sortedEnemies.forEach((enemy, index) => {
      enemy.setSiblingIndex(index);
    });
  }

  private restockEnemyKind(
    mode: EnemyMode,
    kind: string,
    targetCount: number,
    batchLimit: number,
  ) {
    const currentCount = this.countEnemies(kind);
    const spawnCount = Math.min(targetCount - currentCount, batchLimit);

    for (let i = 0; i < spawnCount; i++) {
      this.spawnOneEnemy(mode, kind);
    }
  }

  private countEnemies(kind: string) {
    if (!this.enemyRoot) {
      return 0;
    }

    const enemyName = this.getEnemyName(kind);
    let count = 0;

    for (const enemy of this.enemyRoot.children) {
      if (enemy.name === enemyName) {
        count += 1;
      }
    }

    return count;
  }

  private getEnemyName(kind: string) {
    return `Enemy_${kind}`;
  }

  private updateTimeLabel() {
    if (!this.timeLabel) {
      return;
    }

    const stage = this.getStageInfo();

    this.timeLabel.string = `时间：${Math.ceil(this.leftTime)}\n阶段：${stage.name}\n目标：${stage.target}`;
  }

  private getStageInfo() {
    const elapsedTime = this.gameTime - this.leftTime;

    if (elapsedTime < this.energyZoneStartTime) {
      return {
        name: "发育期",
        target: "吞噬小猎物",
      };
    }

    if (this.zonePhase === ZonePhase.Warning) {
      return {
        name: "危险预警",
        target: "离开红色轰炸区",
      };
    }

    if (this.zonePhase === ZonePhase.Bombing) {
      return {
        name: "危险期",
        target: "避开轰炸并观察清场",
      };
    }

    if (this.zonePhase === ZonePhase.Resource && this.leftTime > 30) {
      return {
        name: "资源期",
        target: "选择黄圈抢资源",
      };
    }

    if (this.zonePhase === ZonePhase.Cooldown) {
      if (elapsedTime >= 220) {
        return {
          name: "终局压力",
          target: "避开巨型球并寻找完整吞噬机会",
        };
      }

      if (elapsedTime >= 135) {
        return {
          name: "巨型球入场",
          target: "利用夹缝发育，不要硬撞红球",
        };
      }

      if (elapsedTime >= 55) {
        return {
          name: "压力上升",
          target: "留意新出现的追逐球",
        };
      }

      return {
        name: "平稳期",
        target: "继续发育并寻找猎物",
      };
    }

    return {
      name: "猎杀期",
      target: "反吃追击球",
    };
  }
  private restartGame() {
    director.loadScene("Main");
  }
  private endGame() {
    this.isGameOver = true;

    const playerController = this.player?.getComponent(PlayerController);
    const finalMass = playerController ? playerController.getMass() : 0;
    const stats = playerController?.getRunStats?.();

    if (this.gameOverLabel) {
      this.prepareGameOverLabel();
      this.gameOverLabel.string = stats
        ? [
            "游戏结束",
            `最终质量：${finalMass}  最高质量：${stats.maxMass}`,
            `食物：+${Math.floor(stats.totalFoodMass)}（普通 ${stats.normalFoodCount}，资源 ${stats.bonusFoodCount}）`,
            `吞噬：+${Math.floor(stats.totalEnemyGainMass)}（完整吃掉 ${stats.killCount} 个）`,
            `恢复：+${Math.floor(stats.totalRecoverMass)}  消耗/受伤：-${Math.floor(stats.totalLossMass)}`,
            `细分：喷射 -${Math.floor(stats.sprayCostMass)}，敌人 -${Math.floor(stats.enemyDamageTakenMass)}，危险区 -${Math.floor(stats.zoneDamageTakenMass)}`,
            `判断：${this.getRunDiagnosis(stats)}`,
          ].join("\n")
        : `游戏结束\n最终质量：${finalMass}`;
      this.gameOverLabel.node.active = true;
    }

    if (this.restartButton) {
      this.restartButton.node.active = true;
    }
  }

  private prepareGameOverLabel() {
    if (!this.gameOverLabel) {
      return;
    }

    const visibleSize = view.getVisibleSize();
    const transform = this.gameOverLabel.node.getComponent(UITransform);

    if (transform) {
      transform.setContentSize(
        Math.min(920, visibleSize.width - 80),
        Math.min(340, visibleSize.height - 120),
      );
    }

    this.gameOverLabel.fontSize = 24;
    this.gameOverLabel.lineHeight = 32;
    this.gameOverLabel.enableWrapText = true;
    this.gameOverLabel.horizontalAlign = Label.HorizontalAlign.CENTER;
    this.gameOverLabel.verticalAlign = Label.VerticalAlign.CENTER;
    this.gameOverLabel.node.setPosition(0, 90, 0);
  }

  private getRunDiagnosis(stats: ReturnType<PlayerController["getRunStats"]>) {
    const gain =
      stats.totalFoodMass +
      stats.totalEnemyGainMass +
      stats.totalRecoverMass;

    if (gain <= 0) {
      return "本局收益不足，先看开局资源和小猎物密度。";
    }

    const foodRatio = stats.totalFoodMass / gain;
    const enemyRatio = stats.totalEnemyGainMass / gain;
    const recoverRatio = stats.totalRecoverMass / gain;
    const lossRatio = stats.totalLossMass / Math.max(gain, 1);

    if (foodRatio >= 0.55) {
      return "成长主要来自食物，若膨胀过快优先看普通/资源食物。";
    }

    if (enemyRatio >= 0.55) {
      return "成长主要来自吞噬，若膨胀过快优先看吃球伤害和击杀奖励。";
    }

    if (recoverRatio >= 0.35) {
      return "恢复占比较高，若挂机偏强优先看自然/惩罚恢复。";
    }

    if (lossRatio <= 0.12) {
      return "损失偏低，若压力不足优先看追逐球和危险区威胁。";
    }

    return "收益结构比较平均，下一步适合按手感微调。";
  }

  private getRandomFoodPosition(): Vec3 | null {
    for (let i = 0; i < 50; i++) {
      const x = Math.random() * this.mapWidth - this.mapWidth / 2;
      const y = Math.random() * this.mapHeight - this.mapHeight / 2;
      const position = new Vec3(x, y, 0);

      if (this.isPositionSafe(position)) {
        return position;
      }
    }

    return null;
  }

  private getRandomEnemyPosition(minDistance: number): Vec3 | null {
    for (let i = 0; i < 50; i++) {
      const x = Math.random() * this.mapWidth - this.mapWidth / 2;
      const y = Math.random() * this.mapHeight - this.mapHeight / 2;
      const position = new Vec3(x, y, 0);

      if (this.isPositionSafe(position, minDistance)) {
        return position;
      }
    }

    return null;
  }

  private getRandomStarterPosition(innerRadius: number, outerRadius: number) {
    const center = this.player?.position ?? new Vec3();
    const angle = Math.random() * Math.PI * 2;
    const distance = innerRadius + Math.random() * (outerRadius - innerRadius);
    const x = center.x + Math.cos(angle) * distance;
    const y = center.y + Math.sin(angle) * distance;

    return new Vec3(
      Math.min(Math.max(x, -this.mapWidth / 2 + 80), this.mapWidth / 2 - 80),
      Math.min(Math.max(y, -this.mapHeight / 2 + 80), this.mapHeight / 2 - 80),
      0,
    );
  }

  private spawnFoodAt(position: Vec3) {
    if (!this.foodPrefab || !this.foodRoot || this.isGameOver) {
      return;
    }

    const food = instantiate(this.foodPrefab);

    food.setPosition(position);
    food.setParent(this.foodRoot);
  }

  private getRandomEnergyZonePosition() {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.sqrt(Math.random()) * this.energyZoneRadius;
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance;

    return new Vec3(x, y, 0);
  }

  private getRandomEnergyZoneHazardPosition(
    innerRadius: number,
    outerRadius: number,
    minPlayerDistance: number,
  ) {
    for (let i = 0; i < 70; i++) {
      const angle = Math.random() * Math.PI * 2;
      const distance = innerRadius + Math.random() * (outerRadius - innerRadius);
      const x = Math.cos(angle) * distance;
      const y = Math.sin(angle) * distance;
      const position = new Vec3(
        Math.min(Math.max(x, -this.mapWidth / 2 + 100), this.mapWidth / 2 - 100),
        Math.min(Math.max(y, -this.mapHeight / 2 + 100), this.mapHeight / 2 - 100),
        0,
      );

      if (this.isPositionSafe(position, minPlayerDistance)) {
        return position;
      }
    }

    return null;
  }

  private isPositionSafe(position: Vec3, extraDistance = this.minSpawnDistance) {
    if (!this.player) {
      return true;
    }

    const playerTransform = this.player.getComponent(UITransform);
    const playerRadius = playerTransform
      ? Math.max(
          playerTransform.contentSize.width,
          playerTransform.contentSize.height,
        ) / 2
      : 40;

    const safeDistance = playerRadius + extraDistance;
    const distance = Vec3.distance(position, this.player.position);

    return distance >= safeDistance;
  }
}
