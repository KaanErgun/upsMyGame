# Orbit Deflect — Teknik Mimari Dokümanı

**Versiyon:** 0.1.0-draft  
**Durum:** Pre-prototype  
**Hedef Stack:** Rust (core) + Tauri + wgpu (render)

---

## İçindekiler

1. [Proje Genel Bakış](#1-proje-genel-bakış)
2. [Mimari Prensipleri](#2-mimari-prensipleri)
3. [Sistem Katmanları](#3-sistem-katmanları)
4. [Klasör ve Modül Yapısı](#4-klasör-ve-modül-yapısı)
5. [Veri Modeli ve Tipler](#5-veri-modeli-ve-tipler)
6. [Simulation Engine](#6-simulation-engine)
7. [Input Sistemi](#7-input-sistemi)
8. [Collision Sistemi](#8-collision-sistemi)
9. [Spawn Orchestration](#9-spawn-orchestration)
10. [Difficulty Sistemi](#10-difficulty-sistemi)
11. [Skor Sistemi](#11-skor-sistemi)
12. [Render Pipeline](#12-render-pipeline)
13. [Audio Sistemi](#13-audio-sistemi)
14. [State Machine](#14-state-machine)
15. [Replay Sistemi](#15-replay-sistemi)
16. [Persistence Layer](#16-persistence-layer)
17. [Test Stratejisi](#17-test-stratejisi)
18. [MVP Roadmap](#18-mvp-roadmap)
19. [Performans Bütçesi](#19-performans-bütçesi)
20. [Kritik Risk Kaydı](#20-kritik-risk-kaydı)

---

## 1. Proje Genel Bakış

### 1.1 Tanım

Orbit Deflect, ekranın merkezine sabitlenmiş bir savunma birimini kontrol eden, refleks tabanlı bir arcade oyunudur. Oyuncunun tek eylemi, açısal bir savunma hattını döndürmektir. Tehditler dışarıdan merkeze yaklaşır; oyuncu doğru açıda ve doğru zamanda karşılık vermelidir.

### 1.2 Tasarım Sözleşmesi

Bu doküman boyunca geçerli olan iki temel sözleşme:

> **Sözleşme 1:** Gameplay kararları (collision, skor, hasar) yalnızca simulation katmanında verilir. Render ve audio bu kararları değiştirmez, yalnızca yansıtır.

> **Sözleşme 2:** Her oyun seansı, aynı seed ve input stream verildiğinde birebir aynı sonucu üretmek zorundadır.

Bu iki sözleşme ihlal edilmez.

### 1.3 Kritik Başarı Faktörü

Bu oyunun yaşaması için gereken tek şey şudur: **oyuncu her ölümde "bu benim hatam" demelidir.** Bu hissin oluşması için:

- Input latency < 50ms olmalıdır
- Collision kararları frame-perfect tutarlı olmalıdır
- Telegraph (tehdit uyarısı) oyuncuya yeterli süre tanımalıdır
- Feedback, neyin olduğunu net anlatmalıdır

---

## 2. Mimari Prensipleri

### 2.1 Katman Bağımsızlığı

```
┌──────────────────────────────────────┐
│         Presentation Layer           │  ← Render, Efektler
├──────────────────────────────────────┤
│           Audio Layer                │  ← Ses, Müzik
├──────────────────────────────────────┤
│         Simulation Layer             │  ← Oyun Mantığı  [merkez]
├──────────────────────────────────────┤
│           Input Layer                │  ← Girdi Toplama
├──────────────────────────────────────┤
│        Persistence Layer             │  ← Kayıt, Replay, Analytics
└──────────────────────────────────────┘
```

Katmanlar arası iletişim **tek yönlüdür**:
- Input → Simulation: `InputCommand` event'leri
- Simulation → Presentation: `RenderSnapshot` ve `GameEvent` buffer'ı
- Simulation → Audio: `AudioEvent` buffer'ı
- Simulation → Persistence: `SessionRecord` ve `ReplayFrame` akışı

### 2.2 Data Flow Diyagramı

```
Raw Input
    │
    ▼
InputProcessor ──→ InputCommand (timestamped)
                        │
                        ▼
                 SimulationEngine
                 ┌──────────────┐
                 │ PlayerSystem │
                 │ ThreatSystem │
                 │ CollisionSys │
                 │ ScoreSystem  │
                 │ DiffSystem   │
                 └──────┬───────┘
                        │
              ┌─────────┼─────────┐
              ▼         ▼         ▼
        RenderSnap  AudioEvent  ReplayFrame
              │         │         │
              ▼         ▼         ▼
          Renderer   AudioMixer  ReplayLog
```

### 2.3 Değişmez Kurallar

| Kural | Gerekçe |
|-------|---------|
| Simulation, render framerate'ini bilmez | Determinism |
| Render, collision hesabı yapamaz | Sözleşme 1 |
| Float karşılaştırması direkt yapılmaz | Determinism |
| Spawn RNG her zaman seeded olur | Replay güvencesi |
| Tüm zaman hesapları `SimTick` cinsinden tutulur | Frame-independence |

---

## 3. Sistem Katmanları

### 3.1 Input Layer

**Sorumluluk:** Ham girdiyi topla, normalize et, timestampla, simulation'a ilet.

**Sorumluluk almaz:** Skor, collision, efekt üretimi.

**Çıktı tipi:** `InputCommand`

**Desteklenen cihazlar:**
- Mouse (target angle projection)
- Analog stick (velocity driven)
- Keyboard (velocity driven, L/R)
- Touch (swipe / tap zone)

### 3.2 Simulation Layer

**Sorumluluk:** Tüm oyun mantığı. Fixed timestep üzerinde çalışır.

**Alt sistemler:**
- `PlayerSystem` — açı güncelleme, hareket sınırları
- `ThreatSystem` — entity güncelleme, yaşam döngüsü
- `SpawnSystem` — yeni tehdit üretimi
- `CollisionSystem` — temas tespiti ve sonuç
- `ScoreSystem` — puan ve combo hesabı
- `DifficultySystem` — baskı parametrelerini günceller
- `HealthSystem` — hasar ve yaşam yönetimi

**Çıktı türleri:**
- `RenderSnapshot` — her tick'te render için state
- `Vec<GameEvent>` — hit, miss, death, combo gibi olaylar
- `ReplayFrame` — replay log için kayıt

### 3.3 Presentation Layer

**Sorumluluk:** `RenderSnapshot` ve `GameEvent` listesini görselleştirir.

**Bileşenler:**
- `SceneRenderer` — sahne çizimi (arc, threats, arena)
- `VFXSystem` — hit flash, shockwave, combo aura
- `UIRenderer` — skor, combo göstergesi, can barı
- `CameraSystem` — shake, zoom, pulse

### 3.4 Audio Layer

**Sorumluluk:** `AudioEvent` listesini ses/müzik çıkışına çevirir.

**Bileşenler:**
- `SFXPlayer` — transient ses efektleri
- `MusicEngine` — dinamik müzik katmanları
- `TensionMixer` — tehdit yoğunluğuna göre harmoni

### 3.5 Persistence Layer

**Sorumluluk:** Skor, replay ve analitik verilerini saklar.

**Bileşenler:**
- `SessionStore` — skor, süre, meta data
- `ReplayWriter` — frame bazlı replay log
- `TelemetrySink` — balancing metrikleri

---

## 4. Klasör ve Modül Yapısı

```
orbit-deflect/
├── Cargo.toml
├── Cargo.lock
│
├── crates/
│   │
│   ├── orbit-core/               # Saf oyun mantığı — no_std uyumlu
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── types.rs           # Temel tipler: Angle, SimTick, EntityId
│   │       ├── math.rs            # Polar matematik, angle helpers
│   │       ├── simulation/
│   │       │   ├── mod.rs
│   │       │   ├── engine.rs      # SimulationEngine ana döngüsü
│   │       │   ├── player.rs      # PlayerSystem
│   │       │   ├── threat.rs      # ThreatSystem
│   │       │   ├── spawn.rs       # SpawnSystem + SpawnOrchestrator
│   │       │   ├── collision.rs   # CollisionSystem
│   │       │   ├── score.rs       # ScoreSystem
│   │       │   ├── difficulty.rs  # DifficultySystem
│   │       │   └── health.rs      # HealthSystem
│   │       ├── input/
│   │       │   ├── mod.rs
│   │       │   └── command.rs     # InputCommand tanımı
│   │       ├── events/
│   │       │   ├── mod.rs
│   │       │   └── game_event.rs  # GameEvent enum
│   │       ├── replay/
│   │       │   ├── mod.rs
│   │       │   └── frame.rs       # ReplayFrame, ReplayLog
│   │       └── rng/
│   │           └── seeded.rs      # Deterministic RNG wrapper
│   │
│   ├── orbit-render/              # wgpu tabanlı render
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── renderer.rs        # Ana render döngüsü
│   │       ├── scene.rs           # Sahne çizimi
│   │       ├── vfx/
│   │       │   ├── mod.rs
│   │       │   ├── hit_flash.rs
│   │       │   ├── shockwave.rs
│   │       │   └── combo_aura.rs
│   │       ├── ui/
│   │       │   ├── mod.rs
│   │       │   └── hud.rs
│   │       └── shaders/
│   │           ├── arc.wgsl
│   │           ├── threat.wgsl
│   │           └── vfx.wgsl
│   │
│   ├── orbit-audio/               # Ses sistemi
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── sfx.rs
│   │       ├── music.rs
│   │       └── mixer.rs
│   │
│   ├── orbit-input/               # Input pipeline
│   │   ├── Cargo.toml
│   │   └── src/
│   │       ├── lib.rs
│   │       ├── processor.rs
│   │       ├── mouse.rs
│   │       ├── keyboard.rs
│   │       └── gamepad.rs
│   │
│   └── orbit-persist/             # Kayıt ve analitik
│       ├── Cargo.toml
│       └── src/
│           ├── lib.rs
│           ├── session.rs
│           ├── replay_writer.rs
│           └── telemetry.rs
│
├── src/                           # Tauri app entry point
│   ├── main.rs
│   ├── app.rs                     # App state ve event loop
│   └── platform/
│       ├── mod.rs
│       └── window.rs
│
├── assets/
│   ├── audio/
│   │   ├── sfx/
│   │   └── music/
│   └── fonts/
│
├── docs/
│   ├── develop-this.md
│   └── technical-architecture.md  # Bu dosya
│
└── tests/
    ├── simulation_determinism.rs
    ├── collision_precision.rs
    └── replay_roundtrip.rs
```

---

## 5. Veri Modeli ve Tipler

### 5.1 Temel Tipler

```rust
// crates/orbit-core/src/types.rs

/// Simulation tick sayacı. Gerçek zamandan bağımsız.
/// 1 tick = 1/60 saniye (FIXED_TIMESTEP ile belirlenir)
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Hash)]
pub struct SimTick(pub u64);

/// Açı: 0.0 = saat 12, clockwise pozitif.
/// Dahili temsil: radyan. Dışa açık API: normalize_angle() her zaman [0, 2π) döner.
#[derive(Debug, Clone, Copy, PartialEq, PartialOrd)]
pub struct Angle(f32);

impl Angle {
    pub fn from_radians(r: f32) -> Self { Self(r.rem_euclid(TAU)) }
    pub fn from_degrees(d: f32) -> Self { Self::from_radians(d.to_radians()) }
    pub fn radians(self) -> f32 { self.0 }
    
    /// İki açı arasındaki en kısa delta. [-π, π] aralığında döner.
    pub fn delta(self, other: Angle) -> f32 {
        let d = (other.0 - self.0).rem_euclid(TAU);
        if d > PI { d - TAU } else { d }
    }
    
    pub fn abs_delta(self, other: Angle) -> f32 {
        self.delta(other).abs()
    }
}

/// Entity benzersiz kimliği
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub struct EntityId(pub u32);

/// Polar koordinat: merkez odaklı mesafe + açı
#[derive(Debug, Clone, Copy)]
pub struct PolarPos {
    pub radius: f32,
    pub angle: Angle,
}
```

### 5.2 Player State

```rust
// crates/orbit-core/src/simulation/player.rs

#[derive(Debug, Clone)]
pub struct PlayerState {
    /// Mevcut savunma hattı açısı
    pub angle: Angle,
    
    /// Hedef açı (smooth rotation için)
    pub target_angle: Angle,
    
    /// Dönüş hızı (radyan/tick)
    pub angular_speed: f32,
    
    /// Kalkan yayı genişliği (radyan). Varsayılan: π/6 (30°)
    pub shield_arc: f32,
    
    /// Tolerans modifiers (perfect, good, scrape zone sınırları)
    pub timing_zones: TimingZones,
    
    /// Can / kalkan gücü
    pub health: Health,
}

#[derive(Debug, Clone, Copy)]
pub struct TimingZones {
    pub perfect: f32,  // açısal tolerans, radyan
    pub good: f32,
    pub scrape: f32,
}

impl Default for TimingZones {
    fn default() -> Self {
        Self {
            perfect: 0.087,  // ~5°
            good:    0.175,  // ~10°
            scrape:  0.262,  // ~15°
        }
    }
}

#[derive(Debug, Clone, Copy)]
pub struct Health {
    pub current: i32,
    pub max: i32,
}
```

### 5.3 Threat Entity

```rust
// crates/orbit-core/src/simulation/threat.rs

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ThreatKind {
    Standard,      // Düz yaklaşan
    Fast,          // Yüksek hız
    Narrow,        // Dar hit window
    Wobble,        // Açısal salınım
    Splitter,      // Çarpışınca bölünen
    Boomerang,     // Yanlış açıda geri dönen
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ThreatLifeState {
    Approaching,
    Deflected,
    Missed,
    Splitting,
}

#[derive(Debug, Clone)]
pub struct ThreatEntity {
    pub id: EntityId,
    pub kind: ThreatKind,
    pub spawn_tick: SimTick,
    
    /// Mevcut pozisyon
    pub pos: PolarPos,
    
    /// Radyal hız: pozitif = merkeze doğru (px/tick)
    pub radial_velocity: f32,
    
    /// Açısal hız (radyan/tick). Standart için 0.
    pub angular_velocity: f32,
    
    /// Wobble için faz bilgisi
    pub wobble_phase: f32,
    pub wobble_amplitude: f32,
    
    /// Çarpışma büyüklüğü (radyan cinsinden açısal yarıçap)
    pub collision_radius: f32,
    
    pub life_state: ThreatLifeState,
}

impl ThreatEntity {
    /// Tehditlerin kalkan etkileşim yarıçapı — bu sabit, gameplay parametresidir
    pub const SHIELD_RADIUS: f32 = 120.0; // px
    
    /// Merkeze ulaşma yarıçapı — buraya ulaşan tehdit "miss" sayılır
    pub const CORE_RADIUS: f32 = 30.0; // px
}
```

### 5.4 Game Events

```rust
// crates/orbit-core/src/events/game_event.rs

/// Simulation'ın ürettiği olaylar. Render ve Audio bu listeyi tüketir.
#[derive(Debug, Clone)]
pub enum GameEvent {
    ThreatDeflected {
        tick: SimTick,
        threat_id: EntityId,
        threat_kind: ThreatKind,
        player_angle: Angle,
        impact_delta: f32,     // açısal sapma (radyan)
        quality: DeflectQuality,
    },
    ThreatMissed {
        tick: SimTick,
        threat_id: EntityId,
        miss_angle: Angle,
        damage_dealt: i32,
    },
    ComboChanged {
        tick: SimTick,
        old_combo: u32,
        new_combo: u32,
        multiplier: f32,
    },
    PlayerDamaged {
        tick: SimTick,
        damage: i32,
        remaining_health: i32,
    },
    PlayerDied {
        tick: SimTick,
        final_score: u64,
        survival_ticks: u64,
    },
    DifficultyPhaseChanged {
        tick: SimTick,
        new_phase: DifficultyPhase,
    },
    ThreatSpawned {
        tick: SimTick,
        threat_id: EntityId,
        kind: ThreatKind,
        spawn_angle: Angle,
    },
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DeflectQuality {
    Perfect,   // |delta| < perfect_zone
    Good,      // |delta| < good_zone
    Scrape,    // |delta| < scrape_zone
}
```

### 5.5 Simulation Output

```rust
// crates/orbit-core/src/simulation/engine.rs

/// Render katmanının bir frame çizmek için ihtiyaç duyduğu tüm data
#[derive(Debug, Clone)]
pub struct RenderSnapshot {
    pub tick: SimTick,
    pub player: PlayerRenderData,
    pub threats: Vec<ThreatRenderData>,
    pub score_state: ScoreState,
    pub health: Health,
    pub difficulty_phase: DifficultyPhase,
}

#[derive(Debug, Clone, Copy)]
pub struct PlayerRenderData {
    pub angle: Angle,
    pub shield_arc: f32,
    pub is_active: bool,
}

#[derive(Debug, Clone, Copy)]
pub struct ThreatRenderData {
    pub id: EntityId,
    pub kind: ThreatKind,
    pub pos: PolarPos,
    pub life_state: ThreatLifeState,
    pub normalized_approach: f32, // 1.0 = spawn, 0.0 = shield_radius
}
```

### 5.6 Difficulty State

```rust
// crates/orbit-core/src/simulation/difficulty.rs

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DifficultyPhase {
    Tutorial,        // 0–15s: tek tehdit, yavaş
    Pressure,        // 15–45s: iki tehdit, hız artışı
    Escalation,      // 45–90s: çeşitlilik
    Chaos,           // 90s+: tam yoğunluk
}

#[derive(Debug, Clone)]
pub struct DifficultyState {
    pub phase: DifficultyPhase,
    pub elapsed_ticks: u64,
    pub pressure_level: f32,       // 0.0 – 1.0
    
    // Spawn parametreleri
    pub spawn_interval_ticks: u32, // Tehditler arası minimum tick
    pub max_concurrent_threats: u8,
    pub speed_multiplier: f32,
    
    // Anti-frustration state
    pub consecutive_misses: u8,
    pub last_spawn_angle: Angle,   // Art arda aynı açıya engel
    pub recent_spawn_angles: [Angle; 4],
}
```

---

## 6. Simulation Engine

### 6.1 Fixed Timestep Loop

```rust
// crates/orbit-core/src/simulation/engine.rs

pub const FIXED_TIMESTEP_HZ: u32 = 60;
pub const FIXED_DT_SECS: f32 = 1.0 / FIXED_TIMESTEP_HZ as f32;

pub struct SimulationEngine {
    pub state: SimulationState,
    rng: SeededRng,
    tick: SimTick,
}

pub struct SimulationState {
    pub player: PlayerState,
    pub threats: Vec<ThreatEntity>,
    pub score: ScoreState,
    pub difficulty: DifficultyState,
    pub phase: GamePhase,
}

impl SimulationEngine {
    pub fn new(seed: u64) -> Self { ... }
    
    /// Her fixed tick'te çağrılır.
    /// Dönüş: bu tick'te üretilen event'ler + render snapshot.
    pub fn tick(
        &mut self,
        commands: &[InputCommand],
    ) -> SimTickOutput {
        let mut events = Vec::new();
        
        // 1. Input uygula
        self.apply_input(commands);
        
        // 2. Player rotasyonunu güncelle
        self.update_player();
        
        // 3. Spawn sistemi çalıştır
        self.spawn_system(&mut events);
        
        // 4. Threat entity'lerini güncelle
        self.update_threats();
        
        // 5. Collision çöz
        self.resolve_collisions(&mut events);
        
        // 6. Skor ve combo güncelle
        self.update_score(&events);
        
        // 7. Difficulty güncelle
        self.update_difficulty(&events);
        
        // 8. Ölü entity'leri temizle
        self.cleanup_threats();
        
        self.tick = SimTick(self.tick.0 + 1);
        
        SimTickOutput {
            snapshot: self.build_snapshot(),
            events,
            replay_frame: self.build_replay_frame(commands),
        }
    }
}

pub struct SimTickOutput {
    pub snapshot: RenderSnapshot,
    pub events: Vec<GameEvent>,
    pub replay_frame: ReplayFrame,
}
```

### 6.2 Ana Uygulama Döngüsü (Tauri App)

```rust
// src/app.rs

/// Render thread'inden bağımsız, kendi thread'inde çalışır.
pub fn run_game_loop(
    sim: Arc<Mutex<SimulationEngine>>,
    input_rx: Receiver<InputCommand>,
    output_tx: Sender<SimTickOutput>,
) {
    let mut accumulator = Duration::ZERO;
    let mut last_time = Instant::now();
    let fixed_dt = Duration::from_secs_f32(FIXED_DT_SECS);
    
    loop {
        let now = Instant::now();
        let frame_time = now - last_time;
        last_time = now;
        
        // Frame spike koruması: tek bir çarpma içinde max 250ms işle
        let frame_time = frame_time.min(Duration::from_millis(250));
        accumulator += frame_time;
        
        // Birikmiş input'ları topla
        let commands: Vec<InputCommand> = input_rx.try_iter().collect();
        
        while accumulator >= fixed_dt {
            let output = sim.lock().tick(&commands);
            output_tx.send(output).ok();
            accumulator -= fixed_dt;
        }
        
        // Render thread'ine interpolation alpha'sını bildir
        let alpha = accumulator.as_secs_f32() / FIXED_DT_SECS;
        // ... render_alpha_tx.send(alpha)
    }
}
```

---

## 7. Input Sistemi

### 7.1 InputCommand

```rust
// crates/orbit-core/src/input/command.rs

#[derive(Debug, Clone, Copy)]
pub struct InputCommand {
    /// Bu command'ın üretildiği tick
    pub tick: SimTick,
    /// Gerçek timestamp (debug ve replay için)
    pub timestamp_ms: u64,
    pub kind: InputKind,
}

#[derive(Debug, Clone, Copy)]
pub enum InputKind {
    /// Mouse/touch: direkt hedef açı
    SetTargetAngle(Angle),
    
    /// Keyboard/gamepad: dönüş yönü
    /// -1.0 = tam sola, +1.0 = tam sağa
    Rotate(f32),
    
    /// Pause/UI komutları
    Pause,
    Confirm,
    Back,
}
```

### 7.2 Input Processor

```rust
// crates/orbit-input/src/processor.rs

pub struct InputProcessor {
    device_mode: DeviceMode,
    last_mouse_angle: Option<Angle>,
    
    // Gamepad deadzone
    stick_deadzone: f32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DeviceMode {
    MouseAngle,     // Target angle mode
    KeyboardAxis,   // Velocity driven
    GamepadAxis,    // Velocity driven
    Touch,          // Target angle mode
}

impl InputProcessor {
    pub fn process_mouse_move(
        &mut self,
        screen_x: f32,
        screen_y: f32,
        center_x: f32,
        center_y: f32,
        tick: SimTick,
    ) -> InputCommand {
        let dx = screen_x - center_x;
        let dy = screen_y - center_y;
        // atan2: ekran koordinatlarında Y aşağı pozitif, oyun koordinatına çevir
        let angle = Angle::from_radians((-dy).atan2(dx));
        InputCommand {
            tick,
            timestamp_ms: current_timestamp_ms(),
            kind: InputKind::SetTargetAngle(angle),
        }
    }
    
    pub fn process_keyboard(
        &self,
        left: bool,
        right: bool,
        tick: SimTick,
    ) -> Option<InputCommand> {
        let axis = match (left, right) {
            (true, false) => -1.0,
            (false, true) =>  1.0,
            _ => return None,
        };
        Some(InputCommand {
            tick,
            timestamp_ms: current_timestamp_ms(),
            kind: InputKind::Rotate(axis),
        })
    }
}
```

### 7.3 Input Latency Analizi

Hedef input-to-simulation gecikmesi:

| Kaynak | Gecikme |
|--------|---------|
| OS → uygulama event | ~1-3ms |
| Input processor | <1ms |
| Channel transfer | <1ms |
| Simulation tick içinde uygulama | 0ms (aynı tick) |
| **Toplam** | **~2-5ms** |

Toplam input-to-photon bütçesi:
- Input → Simulation: ~5ms
- Simulation tick: ~16.6ms
- Render → Display: ~8-16ms
- **Toplam hedef: ~30-40ms**

---

## 8. Collision Sistemi

### 8.1 Çarpışma Mantığı

İki koşul **aynı anda** sağlanmalıdır:

```rust
// crates/orbit-core/src/simulation/collision.rs

pub fn check_deflection(
    player: &PlayerState,
    threat: &ThreatEntity,
) -> Option<DeflectResult> {
    // Koşul 1: Tehdit kalkan yarıçapına ulaşmış mı?
    if threat.pos.radius > ThreatEntity::SHIELD_RADIUS + COLLISION_TOLERANCE {
        return None; // Henüz çok uzakta
    }
    if threat.pos.radius < ThreatEntity::CORE_RADIUS {
        return Some(DeflectResult::Missed); // Artık çok geç
    }
    
    // Koşul 2: Açısal temas — delta [-π, π] normalize edilmiş
    let delta = player.angle.abs_delta(threat.pos.angle);
    let half_arc = player.shield_arc / 2.0;
    
    if delta > half_arc + threat.collision_radius {
        return None; // Açısal temas yok
    }
    
    // Kalite hesapla
    let quality = compute_quality(delta, &player.timing_zones);
    
    Some(DeflectResult::Deflected { quality, delta })
}

fn compute_quality(delta: f32, zones: &TimingZones) -> DeflectQuality {
    if delta <= zones.perfect { DeflectQuality::Perfect }
    else if delta <= zones.good { DeflectQuality::Good }
    else { DeflectQuality::Scrape }
}
```

### 8.2 Özel Durum: Açı Wrap-Around

`359°` ile `1°` arasındaki tehdit, `0°`'daki oyuncuya yakın sayılmalıdır.

Bu `Angle::delta()` metodu ile çözülür — `rem_euclid` ve π geçişi ile normalize edilmiş delta her zaman doğru sonucu verir.

### 8.3 Collision Tolerans Ayarı

```rust
/// Frame geçişinde tehdidin kalkan eşiğini atlayabileceği durum için tolerans.
/// Yüksek hızlı tehditlerde bu kritik olur.
const COLLISION_TOLERANCE: f32 = 8.0; // px — tunable

/// Bu değer, tehdit hızı * fixed_dt > COLLISION_TOLERANCE olduğunda
/// continuous collision detection'a geçilmesini tetikler.
pub fn needs_continuous_collision(threat: &ThreatEntity) -> bool {
    let distance_per_tick = threat.radial_velocity.abs();
    distance_per_tick > COLLISION_TOLERANCE
}
```

---

## 9. Spawn Orchestration

### 9.1 Kontrollü Rastgelelik

```rust
// crates/orbit-core/src/simulation/spawn.rs

pub struct SpawnOrchestrator {
    rng: SeededRng,
    pattern_library: PatternLibrary,
    anti_frustration: AntiFrustrationState,
}

pub struct AntiFrustrationState {
    consecutive_misses: u8,
    recent_spawn_angles: VecDeque<Angle>, // son 4 spawn açısı
    last_spawn_tick: SimTick,
    
    /// Aynı açıya art arda spawn engellemek için minimum açı farkı
    min_angle_separation: f32,
}

impl SpawnOrchestrator {
    pub fn try_spawn(
        &mut self,
        difficulty: &DifficultyState,
        current_threats: usize,
        tick: SimTick,
    ) -> Option<ThreatSpawnConfig> {
        // 1. Zamanlama kontrolü
        if !self.is_spawn_ready(difficulty, tick) {
            return None;
        }
        
        // 2. Concurrent cap kontrolü
        if current_threats >= difficulty.max_concurrent_threats as usize {
            return None;
        }
        
        // 3. Tehdit tipi seç (difficulty fazına göre ağırlıklı)
        let kind = self.pick_threat_kind(difficulty);
        
        // 4. Spawn açısı seç (anti-frustration uygulanmış)
        let angle = self.pick_spawn_angle();
        
        // 5. Hız hesapla
        let speed = self.compute_speed(kind, difficulty);
        
        self.anti_frustration.record_spawn(angle, tick);
        
        Some(ThreatSpawnConfig { kind, angle, speed, tick })
    }
    
    fn pick_spawn_angle(&mut self) -> Angle {
        const MAX_ATTEMPTS: usize = 10;
        
        for _ in 0..MAX_ATTEMPTS {
            let candidate = Angle::from_radians(
                self.rng.next_f32() * TAU
            );
            
            if self.is_angle_acceptable(candidate) {
                return candidate;
            }
        }
        
        // Max deneme aşıldıysa en az kalabalık bölgeyi döndür
        self.find_least_crowded_angle()
    }
    
    fn is_angle_acceptable(&self, candidate: Angle) -> bool {
        self.anti_frustration.recent_spawn_angles.iter().all(|&recent| {
            candidate.abs_delta(recent) > self.anti_frustration.min_angle_separation
        })
    }
}
```

### 9.2 Pattern Library

```rust
pub struct SpawnPattern {
    pub name: &'static str,
    pub threat_configs: Vec<PatternThreatConfig>,
    /// Pattern'ın hangi difficulty fazlarında kullanılabileceği
    pub min_phase: DifficultyPhase,
    /// Spawn başlangıçları arası tick offsetleri
    pub tick_offsets: Vec<u32>,
}

/// Örnek pattern: "Pincer"
/// İki tehdit zıt yönden aynı anda yaklaşır
pub const PATTERN_PINCER: SpawnPattern = SpawnPattern {
    name: "pincer",
    threat_configs: vec![
        PatternThreatConfig { kind: ThreatKind::Standard, angle_offset: 0.0 },
        PatternThreatConfig { kind: ThreatKind::Standard, angle_offset: PI },
    ],
    min_phase: DifficultyPhase::Pressure,
    tick_offsets: vec![0, 0], // aynı anda
};
```

---

## 10. Difficulty Sistemi

### 10.1 Faz Geçiş Mantığı

```rust
// crates/orbit-core/src/simulation/difficulty.rs

impl DifficultySystem {
    pub fn update(
        &mut self,
        state: &mut DifficultyState,
        events: &[GameEvent],
        tick: SimTick,
    ) -> Option<DifficultyPhase> {
        state.elapsed_ticks = tick.0;
        
        // Olay bazlı anti-frustration
        for event in events {
            if let GameEvent::ThreatMissed { .. } = event {
                state.consecutive_misses += 1;
            } else if let GameEvent::ThreatDeflected { .. } = event {
                state.consecutive_misses = 0;
            }
        }
        
        // Anti-frustration: 3 üst üste miss'te spawn yavaşlar
        if state.consecutive_misses >= 3 {
            state.spawn_interval_ticks = (state.spawn_interval_ticks as f32 * 1.3) as u32;
        }
        
        // Faz geçiş kontrolü
        let new_phase = self.compute_phase(state);
        if new_phase != state.phase {
            state.phase = new_phase;
            self.apply_phase_params(state, new_phase);
            return Some(new_phase);
        }
        
        // Sürekli pressure artışı (faz içi)
        state.pressure_level = self.compute_pressure(state);
        self.apply_pressure(state);
        
        None
    }
    
    fn compute_phase(&self, state: &DifficultyState) -> DifficultyPhase {
        let elapsed_secs = state.elapsed_ticks as f32 * FIXED_DT_SECS;
        match elapsed_secs as u32 {
            0..=14  => DifficultyPhase::Tutorial,
            15..=44 => DifficultyPhase::Pressure,
            45..=89 => DifficultyPhase::Escalation,
            _       => DifficultyPhase::Chaos,
        }
    }
}

/// Her faz için temel parametreler
pub const PHASE_PARAMS: &[(DifficultyPhase, PhaseParams)] = &[
    (DifficultyPhase::Tutorial, PhaseParams {
        spawn_interval_ticks: 180,  // 3 saniye
        max_concurrent: 1,
        speed_mult: 0.6,
    }),
    (DifficultyPhase::Pressure, PhaseParams {
        spawn_interval_ticks: 120,  // 2 saniye
        max_concurrent: 2,
        speed_mult: 0.85,
    }),
    (DifficultyPhase::Escalation, PhaseParams {
        spawn_interval_ticks: 75,
        max_concurrent: 3,
        speed_mult: 1.0,
    }),
    (DifficultyPhase::Chaos, PhaseParams {
        spawn_interval_ticks: 45,
        max_concurrent: 4,
        speed_mult: 1.3,
    }),
];
```

---

## 11. Skor Sistemi

### 11.1 Skor Formülü

```rust
// crates/orbit-core/src/simulation/score.rs

pub struct ScoreState {
    pub total: u64,
    pub combo: u32,
    pub multiplier: f32,
    pub survival_ticks: u64,
    pub perfect_count: u32,
    pub near_miss_count: u32,
}

impl ScoreSystem {
    pub fn on_deflect(
        state: &mut ScoreState,
        quality: DeflectQuality,
        difficulty: &DifficultyState,
    ) {
        let base = match quality {
            DeflectQuality::Perfect => 150,
            DeflectQuality::Good    => 100,
            DeflectQuality::Scrape  => 50,
        };
        
        // Combo artır
        state.combo += 1;
        state.multiplier = Self::combo_to_multiplier(state.combo);
        
        // Difficulty bonus
        let pressure_bonus = 1.0 + difficulty.pressure_level * 0.5;
        
        let points = (base as f32 * state.multiplier * pressure_bonus) as u64;
        state.total += points;
        
        if quality == DeflectQuality::Perfect {
            state.perfect_count += 1;
        }
    }
    
    pub fn on_miss(state: &mut ScoreState) {
        // Combo kır, multiplier'ı sıfırla
        state.combo = 0;
        state.multiplier = 1.0;
    }
    
    fn combo_to_multiplier(combo: u32) -> f32 {
        match combo {
            0..=4   => 1.0,
            5..=9   => 1.5,
            10..=19 => 2.0,
            20..=34 => 3.0,
            _       => 4.0,
        }
    }
    
    /// Survival bonusu her 10 saniyede bir eklenir
    pub fn apply_survival_bonus(state: &mut ScoreState, tick: SimTick) {
        if tick.0 % (FIXED_TIMESTEP_HZ as u64 * 10) == 0 {
            let bonus = (state.multiplier * 200.0) as u64;
            state.total += bonus;
        }
    }
}
```

---

## 12. Render Pipeline

### 12.1 Interpolation

Render katmanı, iki ardışık simulation snapshot arasında interpolasyon yapar:

```rust
// crates/orbit-render/src/renderer.rs

pub struct Renderer {
    prev_snapshot: Option<RenderSnapshot>,
    curr_snapshot: Option<RenderSnapshot>,
    active_vfx: Vec<ActiveVFX>,
}

impl Renderer {
    pub fn render(&mut self, alpha: f32) {
        let Some(curr) = &self.curr_snapshot else { return };
        let Some(prev) = &self.prev_snapshot else {
            self.draw_snapshot(curr, 1.0);
            return;
        };
        
        // Player açısı interpolasyonu — açı wrap-around korumalı
        let player_angle = interpolate_angle(
            prev.player.angle,
            curr.player.angle,
            alpha,
        );
        
        // Threat pozisyon interpolasyonu
        let interpolated_threats: Vec<_> = curr.threats.iter()
            .filter_map(|ct| {
                let pt = prev.threats.iter().find(|t| t.id == ct.id)?;
                Some(interpolate_threat(pt, ct, alpha))
            })
            .collect();
        
        self.draw_scene(player_angle, &interpolated_threats, alpha);
        self.draw_vfx(alpha);
        self.draw_hud(&curr.score_state, &curr.health);
    }
}

fn interpolate_angle(from: Angle, to: Angle, alpha: f32) -> Angle {
    // En kısa yol üzerinden interpolasyon
    let delta = from.delta(to);
    Angle::from_radians(from.radians() + delta * alpha)
}
```

### 12.2 VFX Sistemi

```rust
// crates/orbit-render/src/vfx/mod.rs

pub struct ActiveVFX {
    pub kind: VFXKind,
    pub spawn_time: f32,    // gerçek zaman (saniye)
    pub duration: f32,
    pub params: VFXParams,
}

pub enum VFXKind {
    HitFlash { angle: Angle, quality: DeflectQuality },
    RadialShockwave { angle: Angle, intensity: f32 },
    ComboAura { level: u32 },
    ScreenShake { magnitude: f32 },
    DeathDistortion,
    ThreatTelegraph { angle: Angle, ttl_ticks: u32 },
}

impl VFXSystem {
    /// GameEvent listesinden VFX üret
    pub fn process_events(&mut self, events: &[GameEvent], now: f32) {
        for event in events {
            match event {
                GameEvent::ThreatDeflected { quality, .. } => {
                    let intensity = match quality {
                        DeflectQuality::Perfect => 1.0,
                        DeflectQuality::Good    => 0.7,
                        DeflectQuality::Scrape  => 0.4,
                    };
                    self.spawn_vfx(VFXKind::RadialShockwave {
                        angle: /* impact angle */,
                        intensity,
                    }, 0.3, now);
                    
                    // Perfect hit: ekstra efekt
                    if *quality == DeflectQuality::Perfect {
                        self.spawn_vfx(VFXKind::HitFlash {
                            angle: /* impact angle */,
                            quality: *quality,
                        }, 0.15, now);
                    }
                }
                GameEvent::PlayerDied { .. } => {
                    self.spawn_vfx(VFXKind::DeathDistortion, 1.5, now);
                }
                _ => {}
            }
        }
    }
}
```

---

## 13. Audio Sistemi

### 13.1 Audio Event Pipeline

```rust
// crates/orbit-audio/src/sfx.rs

#[derive(Debug, Clone)]
pub enum AudioEvent {
    Deflect { quality: DeflectQuality },
    Miss { threat_kind: ThreatKind },
    ComboEscalate { level: u32 },
    ComboBreak,
    DangerPulse { intensity: f32 },
    Death,
    PhaseChange { phase: DifficultyPhase },
    ThreatApproaching { threat_id: EntityId, distance_normalized: f32 },
}
```

### 13.2 Dinamik Müzik Sistemi

```rust
// crates/orbit-audio/src/music.rs

pub struct MusicEngine {
    /// Her layer bağımsız bir audio stream
    layers: [MusicLayer; 5],
    active_combo_level: u32,
    danger_intensity: f32,
}

pub struct MusicLayer {
    pub kind: MusicLayerKind,
    pub current_volume: f32,
    pub target_volume: f32,
    pub fade_speed: f32,
}

pub enum MusicLayerKind {
    BaseAmbient,       // Her zaman aktif, düşük seviye
    Rhythm,            // Combo 5+ olduğunda devreye girer
    Percussion,        // Combo 10+ 
    HarmonicTension,   // Danger zone'da
    MelodyLead,        // Yüksek skor / chaos fazı
}

impl MusicEngine {
    pub fn update(&mut self, events: &[AudioEvent], dt: f32) {
        for event in events {
            match event {
                AudioEvent::ComboEscalate { level } => {
                    self.set_combo_level(*level);
                }
                AudioEvent::ComboBreak => {
                    self.set_combo_level(0);
                }
                AudioEvent::DangerPulse { intensity } => {
                    self.layers[MusicLayerKind::HarmonicTension as usize]
                        .target_volume = *intensity;
                }
                AudioEvent::Death => {
                    // Tüm layer'ları ani fade out
                    self.kill_all_layers();
                }
                _ => {}
            }
        }
        
        // Smooth fade in/out
        for layer in &mut self.layers {
            layer.current_volume = lerp(
                layer.current_volume,
                layer.target_volume,
                layer.fade_speed * dt,
            );
        }
    }
}
```

---

## 14. State Machine

### 14.1 Oyun Durumları

```
                    ┌──────────┐
               ┌───►│   Boot   │
               │    └────┬─────┘
               │         │ assets loaded
               │    ┌────▼─────┐
               │    │   Menu   │◄──────────────────┐
               │    └────┬─────┘                   │
               │         │ play pressed             │
               │    ┌────▼──────────┐               │
               │    │   PreGame     │               │
               │    │ (seed + init) │               │
               │    └────┬──────────┘               │
               │         │ countdown done           │
               │    ┌────▼──────────┐               │
               │    │    InGame     │◄──── unpause  │
               │    │  (simulation) │               │
               │    └──┬───────┬───┘               │
               │       │pause  │die                 │
               │  ┌────▼────┐  │                    │
               │  │ Paused  │  │                    │
               │  └─────────┘  │                    │
               │          ┌────▼──────┐             │
               │          │ GameOver  │             │
               │          │ (summary) │─── restart ─┘
               │          └─────┬─────┘
               │                │ menu
               └────────────────┘
```

### 14.2 State Machine Implementasyonu

```rust
// src/app.rs

pub enum GameState {
    Boot(BootState),
    Menu(MenuState),
    PreGame(PreGameState),
    InGame(InGameState),
    Paused(PausedState),
    GameOver(GameOverState),
}

pub struct InGameState {
    pub simulation: SimulationEngine,
    pub renderer: Renderer,
    pub audio: AudioSystem,
    pub replay_writer: ReplayWriter,
}

impl GameState {
    pub fn transition(self, event: StateEvent) -> Self {
        match (self, event) {
            (GameState::Menu(_), StateEvent::PlayPressed) => {
                let seed = generate_session_seed();
                GameState::PreGame(PreGameState::new(seed))
            }
            (GameState::PreGame(pre), StateEvent::CountdownFinished) => {
                GameState::InGame(InGameState::new(pre.seed))
            }
            (GameState::InGame(game), StateEvent::PlayerDied) => {
                let summary = game.build_summary();
                GameState::GameOver(GameOverState::new(summary))
            }
            (GameState::InGame(game), StateEvent::Pause) => {
                GameState::Paused(PausedState::new(game))
            }
            // ...
            _ => self, // Geçersiz geçişler görmezden gelinir
        }
    }
}
```

---

## 15. Replay Sistemi

### 15.1 Replay Formatı

```rust
// crates/orbit-core/src/replay/frame.rs

/// Replay log header — session başına bir tane
#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct ReplayHeader {
    pub version: u32,           // Oyun versiyonu hash'i
    pub seed: u64,              // Spawn ve RNG seed'i
    pub timestamp: u64,         // Unix timestamp
    pub session_id: Uuid,
    pub fixed_timestep_hz: u32, // Replay oynatırken doğrulama için
}

/// Her simulation tick için input snapshot
#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct ReplayFrame {
    pub tick: u64,
    pub commands: Vec<InputCommand>,
    
    /// Opsiyonel checksum: simulation state hash'i
    /// Her 60 tick'te bir — hile tespiti ve bug izolasyonu için
    #[serde(skip_serializing_if = "Option::is_none")]
    pub state_checksum: Option<u32>,
}

pub struct ReplayLog {
    pub header: ReplayHeader,
    pub frames: Vec<ReplayFrame>,
    pub final_score: u64,
    pub survival_ticks: u64,
}
```

### 15.2 Replay Playback

```rust
// crates/orbit-core/src/replay/mod.rs

pub struct ReplayPlayer {
    engine: SimulationEngine,
    frames: VecDeque<ReplayFrame>,
    current_tick: u64,
}

impl ReplayPlayer {
    pub fn from_log(log: ReplayLog) -> Result<Self, ReplayError> {
        // Version uyumu kontrol et
        if log.header.version != current_version_hash() {
            return Err(ReplayError::VersionMismatch);
        }
        
        Ok(Self {
            engine: SimulationEngine::new(log.header.seed),
            frames: log.frames.into_iter().collect(),
            current_tick: 0,
        })
    }
    
    pub fn step(&mut self) -> Option<SimTickOutput> {
        let frame = self.frames.pop_front()?;
        
        let output = self.engine.tick(&frame.commands);
        
        // Checksum doğrulaması
        if let Some(expected) = frame.state_checksum {
            let actual = compute_state_checksum(&self.engine.state);
            if actual != expected {
                // Determinism ihlali — log edilir
                eprintln!("REPLAY CHECKSUM MISMATCH at tick {}", self.current_tick);
            }
        }
        
        self.current_tick += 1;
        Some(output)
    }
}
```

---

## 16. Persistence Layer

### 16.1 Session Kaydı

```rust
// crates/orbit-persist/src/session.rs

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct SessionRecord {
    pub session_id: Uuid,
    pub timestamp: u64,
    pub seed: u64,
    
    // Sonuç metrikleri
    pub final_score: u64,
    pub survival_secs: f32,
    pub perfect_deflects: u32,
    pub good_deflects: u32,
    pub scrape_deflects: u32,
    pub misses: u32,
    pub max_combo: u32,
    pub death_cause: DeathCause,
    
    // Balancing için dağılım verileri
    pub miss_angle_histogram: Vec<f32>,  // radyan cinsinden miss açıları
    pub input_device: InputDeviceKind,
    pub difficulty_at_death: DifficultyPhase,
}

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub enum DeathCause {
    DirectHit { threat_kind: ThreatKind },
    HealthDepleted,
    // İleride: TimeLimit, etc.
}
```

### 16.2 Yerel Depolama (MVP)

```
~/.orbit-deflect/
├── sessions/
│   ├── {session_id}.json    ← SessionRecord
│   └── ...
├── replays/
│   ├── {session_id}.replay  ← binary (bincode) ReplayLog
│   └── ...
├── leaderboard.json         ← yerel en iyi 10 skor
└── settings.json
```

---

## 17. Test Stratejisi

### 17.1 Birim Testler

```rust
// tests/collision_precision.rs

#[test]
fn test_angle_wrap_around() {
    let player_angle = Angle::from_degrees(1.0);
    let threat_angle = Angle::from_degrees(359.0);
    
    // 2° fark — kalkan ± 15° içindeyse temas etmeli
    assert!(player_angle.abs_delta(threat_angle) < 0.05); // ~3°
}

#[test]
fn test_deflect_quality_zones() {
    let zones = TimingZones::default();
    
    assert_eq!(compute_quality(0.05, &zones), DeflectQuality::Perfect);
    assert_eq!(compute_quality(0.12, &zones), DeflectQuality::Good);
    assert_eq!(compute_quality(0.22, &zones), DeflectQuality::Scrape);
}

#[test]
fn test_spawn_angle_separation() {
    let mut orchestrator = SpawnOrchestrator::new(42);
    let mut angles = Vec::new();
    
    for _ in 0..10 {
        let config = orchestrator.force_spawn_for_test();
        angles.push(config.angle);
    }
    
    // Art arda hiçbir spawn 0.5 radyandan yakın olmamalı
    for window in angles.windows(2) {
        assert!(window[0].abs_delta(window[1]) > 0.5);
    }
}
```

### 17.2 Determinizm Testleri

```rust
// tests/simulation_determinism.rs

#[test]
fn test_same_seed_same_outcome() {
    let seed = 12345u64;
    let inputs = generate_test_input_sequence();
    
    let score_a = run_simulation(seed, &inputs);
    let score_b = run_simulation(seed, &inputs);
    
    assert_eq!(score_a, score_b, "Simulation must be deterministic");
}

#[test]
fn test_replay_roundtrip() {
    let seed = 99999u64;
    let inputs = generate_random_inputs(300); // 5 saniyelik girdi
    
    let (original_output, replay_log) = run_simulation_with_replay(seed, &inputs);
    let replayed_output = replay_simulation(replay_log);
    
    assert_eq!(original_output.final_score, replayed_output.final_score);
    assert_eq!(original_output.survival_ticks, replayed_output.survival_ticks);
}
```

### 17.3 Input Latency Profiling

```rust
// Sadece --features=profiling ile aktif olur
#[cfg(feature = "profiling")]
pub struct InputLatencyProfiler {
    samples: Vec<Duration>,
}

#[cfg(feature = "profiling")]
impl InputLatencyProfiler {
    pub fn record(&mut self, input_ts: Instant, simulation_ts: Instant) {
        self.samples.push(simulation_ts - input_ts);
    }
    
    pub fn report(&self) {
        let avg = self.samples.iter().sum::<Duration>() / self.samples.len() as u32;
        let p99 = self.percentile(99);
        println!("Input latency — avg: {avg:?}, p99: {p99:?}");
    }
}
```

---

## 18. MVP Roadmap

### Faz 1: Core Loop (Hafta 1-2)

**Hedef:** Oynanabilir prototip. Efekt yok, skor var.

- [ ] `orbit-core` crate iskelet
- [ ] `Angle`, `SimTick`, `PolarPos` tipleri
- [ ] `SimulationEngine` — fixed timestep loop
- [ ] `PlayerSystem` — açı güncelleme (keyboard)
- [ ] `ThreatSystem` — tek tip tehdit, düz yaklaşım
- [ ] `CollisionSystem` — temel angular check
- [ ] `ScoreSystem` — base puan + combo
- [ ] Placeholder render (SDL2 veya egui ile)

**Çıkış kriteri:** Oyun başlar, tehdit gelir, vurulunca skor artar, kaçırılınca ölünür.

### Faz 2: Fairness Katmanı (Hafta 3)

**Hedef:** Oyunun "adil" hissettirdiği doğrulanır.

- [ ] Mouse/touch input — target angle mode
- [ ] Determinizm testleri
- [ ] Replay kaydı başlangıcı
- [ ] Telegraph görseli — tehdit yaklaşırken uyarı
- [ ] Timing quality (perfect/good/scrape) görsel geri bildirimi
- [ ] Anti-frustration spawn kuralları

**Çıkış kriteri:** Test oyuncuları "neden öldüm" sorusunu %80 oranında doğru cevaplayabilmeli.

### Faz 3: Feel Katmanı (Hafta 4-5)

**Hedef:** Oyunun "iyi hissettirmesi".

- [ ] wgpu render geçişi
- [ ] VFX: hit flash, shockwave, screen shake
- [ ] Temel ses efektleri (deflect, miss, death)
- [ ] Combo göstergesi + aura efekti
- [ ] Dinamik müzik — combo layer'ları
- [ ] Difficulty fazları: Tutorial → Pressure → Escalation

**Çıkış kriteri:** Oyunun "arcade" hissi oturmuş olmalı.

### Faz 4: Polish ve Balancing (Hafta 6)

**Hedef:** Oyun bitirilebilir ve paylaşılabilir hale gelir.

- [ ] Game over ekranı + skor özeti
- [ ] Yerel leaderboard
- [ ] Chaos fazı + tüm tehdit tipleri
- [ ] Replay kaydı tamamlama
- [ ] Telemetri toplama
- [ ] Tauri paketleme (macOS + Windows)

---

## 19. Performans Bütçesi

| Bileşen | Hedef | Limit |
|---------|-------|-------|
| Simulation tick süresi | < 0.5ms | 2ms |
| Render frame (60fps bütçesi) | < 12ms | 16ms |
| Input → simulation gecikme | < 5ms | 10ms |
| Audio event işleme | < 1ms | 3ms |
| Bellek kullanımı (toplam) | < 150MB | 300MB |
| Binary boyutu (release) | < 30MB | 80MB |

**Threat entity limiti:** Ekranda eş zamanlı maksimum 8 tehdit. Bu sayı üzerinde `max_concurrent_threats` hiçbir zaman çıkmayacak şekilde `DifficultySystem` sınırlar.

---

## 20. Kritik Risk Kaydı

| Risk | Olasılık | Etki | Azaltma Stratejisi |
|------|----------|------|--------------------|
| Input latency bütçe aşımı | Orta | Yüksek | Erken profiling, tick-başı input okuma |
| Floating-point determinizm sorunu | Orta | Kritik | `f32` tutarlılığı, cross-platform testler |
| Spawn sistemi unfair hissettirme | Yüksek | Yüksek | Anti-frustration kuralları + playtest metrikleri |
| VFX okunurluğu bozması | Orta | Yüksek | "Readability first" VFX öncelik kuralı |
| Faz geçişlerinde hissedilemeyen zorluk artışı | Orta | Orta | Playtest + telemetri |
| Replay format versiyon uyumsuzluğu | Düşük | Orta | Version hash header + migration |
| Combo sistemi exploit edilebilirliği | Düşük | Düşük | Core survival ödülü, combo bonus ikincil |

---

## Ek A: Bağımlılık Listesi (Taslak)

```toml
# Cargo.toml (workspace kök)

[workspace]
members = [
    "crates/orbit-core",
    "crates/orbit-render",
    "crates/orbit-audio",
    "crates/orbit-input",
    "crates/orbit-persist",
    "src",  # Tauri app
]

# orbit-core (no_std uyumlu hedef)
[dependencies]
serde = { version = "1", features = ["derive"] }
bincode = "2"
uuid = "1"

# orbit-render
wgpu = "0.20"
winit = "0.29"
bytemuck = "1"

# orbit-audio
kira = "0.9"          # veya cpal + dasp

# orbit-input
winit = "0.29"        # shared

# orbit-persist
serde_json = "1"
bincode = "2"
directories = "5"     # OS-uyumlu app data yolu

# Tauri app
tauri = { version = "2", features = ["..."] }
```

---

## Ek B: Açı Koordinat Sistemi

```
            0° (yukarı / saat 12)
                  │
        270°──────┼──────90°
                  │
            180° (aşağı)

Clockwise pozitif. Radyan kullanılır dahili.
Ekran koordinatından dönüşüm:
  angle = atan2(-dy, dx)  // Y ekseni ters çevrilmiş
```

---

*Bu doküman, aktif geliştirme sürecinde güncel tutulacaktır. Mimari kararlar değiştiğinde bu doküman önce güncellenir.*
