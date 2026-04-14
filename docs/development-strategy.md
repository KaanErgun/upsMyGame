# Orbit Deflect — Geliştirme Stratejisi

**Versiyon:** 1.0  
**Durum:** Aktif  
**Son Güncelleme:** 2026-04-12

---

## İçindekiler

1. [Temel Felsefe](#1-temel-felsefe)
2. [Üç Zorunlu İlke](#2-üç-zorunlu-ilke)
3. [Mimari Katmanlar ve Sorumluluklar](#3-mimari-katmanlar-ve-sorumluluklar)
4. [Geliştirme Protokolü](#4-geliştirme-protokolü)
5. [Sistem Bazlı Kurallar](#5-sistem-bazlı-kurallar)
6. [Feedback Tasarımı](#6-feedback-tasarımı)
7. [Determinism Güvencesi](#7-determinism-güvencesi)
8. [Performans Bütçesi ve Latency Yönetimi](#8-performans-bütçesi-ve-latency-yönetimi)
9. [Test ve Debug Stratejisi](#9-test-ve-debug-stratejisi)
10. [Geliştirme Aşamaları (Milestone Planı)](#10-geliştirme-aşamaları-milestone-planı)
11. [Anti-Pattern Katalogu](#11-anti-pattern-katalogu)
12. [Karar Çerçevesi](#12-karar-çerçevesi)

---

## 1. Temel Felsefe

Bu proje bir grafik gösterisi değildir. Bir ses tasarımı egzersizi değildir. Bu proje şu problemin çözümüdür:

> **Oyuncunun yaptığı hamle ile oyunun verdiği yanıt arasındaki mesafeyi sıfıra yaklaştırmak.**

Her geliştirme kararı bu cümleyle sınanır.

### Başarı Kriteri

Oyun şu anda başarılıdır eğer:

- Oyuncu her ölümde **"bu benim hatam"** diyebiliyorsa
- Oyuncu her deflect'te **"bunu ben yaptım"** hissediyorsa
- İki session arasında **aynı hamle aynı sonucu** üretiyorsa

Oyun şu anda başarısızdır eğer:

- Oyuncu "bastım ama olmadı" diyorsa
- Oyuncu "ne zaman basacağımı bilmiyorum" diyorsa
- İki farklı oturumda aynı hamle farklı sonuç üretiyorsa

---

## 2. Üç Zorunlu İlke

Bu üç ilke ihlal edilemez. Herhangi biri bozulduğunda yapılan geliştirme yanlış yöndedir.

### İlke 1: Core Loop Netliği

Oyunun tüm varlık sebebi üç mekanikten oluşur:

```
AÇI KONTROLÜ + TIMING + COLLISION
```

Bu üçü oyunun DNA'sıdır. Yeni bir sistem eklemeden önce şunu sor:

> "Bu sistem bu üç mekaniği destekliyor mu, yoksa onların önüne mi geçiyor?"

Destekliyorsa ekle. Önüne geçiyorsa reddet.

**Pratik Sınır Testi:**

| Yeni Özellik | Sorumluluk | Kabul Edilir mi? |
|---|---|---|
| Tehdit hız artışı | Timing'i zorlaştırır | ✓ |
| Çift açıdan eşzamanlı tehdit | Açı kararını zorlaştırır | ✓ |
| Arka plan animasyonu | Core loop'a dokunmaz | ✓ |
| Tehdidin oyuncuya çarpmadan önce yön değiştirmesi | Timing'i bozar, okunaksız | ✗ |
| Rastgele hitbox genişlemesi | Collision'ı bozar, unfair | ✗ |

---

### İlke 2: Deterministic Simulation

**Tanım:** Aynı seed + aynı input akışı → her zaman aynı oyun durumu.

Bu ilke olmadan:

- Bug tekrarlanamaz → debug imkansızlaşır
- Replay sistemi çalışmaz
- Oyuncu deneyimi frame rate'e bağımlı hale gelir
- "Şansla geçtim" hissi ortaya çıkar

**Determinism'i tehdit eden kaynaklar:**

```
✗ std::time::SystemTime  →  sabit timestep ile izole et
✗ thread::sleep()        →  game loop'tan uzak tut
✗ f32 köşe hesaplamaları →  aynı platform garantisi yok
✗ HashMap iterasyon sırası →  BTreeMap veya sıralı Vec kullan
✗ Paralel thread yarışı  →  simulation single-threaded kalmalı
✗ OS rasgeleliği (rand)  →  seed tabanlı PRNG kullan
```

**Doğrulama Yöntemi:**

Her milestone'da şu testi çalıştır:

```
run(seed=42, input_log=A) → snapshot_1
run(seed=42, input_log=A) → snapshot_2
assert snapshot_1 == snapshot_2
```

Bu test geçmiyorsa milestone kapanmaz.

---

### İlke 3: Fixed Timestep Modeli

**Tanım:** Simulation sabit adımlarla ilerler. Render bağımsız çalışır.

```
┌─────────────────────────────────────────────┐
│  GAME LOOP                                  │
│                                             │
│  accumulator += real_delta_time             │
│                                             │
│  while accumulator >= FIXED_STEP:           │
│      simulate(FIXED_STEP)    ← sabit 16ms  │
│      accumulator -= FIXED_STEP              │
│                                             │
│  alpha = accumulator / FIXED_STEP           │
│  render(interpolate(prev, curr, alpha))     │
│                                             │
└─────────────────────────────────────────────┘
```

**Neden kritik:**

- 30 FPS'te oynayan oyuncu ile 144 FPS'te oynayan oyuncu **aynı collision window'a** sahip olur
- Frame drop olduğunda simulation yavaşlamaz, birden fazla adım hesaplanır
- Render jitter gameplay'i etkilemez

**Sabit Parametreler:**

```rust
const FIXED_STEP: f64 = 1.0 / 60.0;  // 60Hz simulation
const MAX_STEPS_PER_FRAME: u32 = 5;   // spiral of death koruması
```

`MAX_STEPS_PER_FRAME` aşılırsa simulation yavaşlar ama tutarlılığını korur.

---

## 3. Mimari Katmanlar ve Sorumluluklar

### Katman Haritası

```
orbit-deflect/
├── core/        ← Deterministic simulation engine
├── input/       ← Input toplama ve normalize
├── gameplay/    ← Entity mantığı, collision, kurallar
├── systems/     ← Difficulty, spawn, scoring
├── render/      ← WebGL / wgpu görselleştirme
├── audio/       ← Ses feedback sistemi
├── replay/      ← Seed + input log yönetimi
└── app/         ← Tauri shell, UI, lifecycle
```

### Katman Sorumluluk Matrisi

| Katman | Yapabilir | Yapamaz | Bağımlılık |
|--------|-----------|---------|------------|
| **core** | Game loop, timing, state yönetimi | Render çağrısı, UI erişimi | Hiçbir şeye |
| **input** | Raw input okuma, normalize etme | Gameplay kararı, skor hesabı | Yalnızca core'a |
| **gameplay** | Collision, entity update, kurallar | Shader çağrısı, ses tetikleme | core, input |
| **systems** | Difficulty eğrisi, spawn pattern, skor | Input okuma, UI değiştirme | core, gameplay |
| **render** | Görselleştirme, interpolasyon | Gameplay kararı, state değiştirme | core (snapshot) |
| **audio** | Ses tetikleme, mix | Logic değiştirme | core (events) |
| **replay** | Seed kaydetme, input log | Simulation çalıştırma | core, input |
| **app** | UI, pencere, lifecycle | Core logic | Tüm katmanlar |

### İletişim Protokolü

Katmanlar arası iletişim **yalnızca tanımlanmış arayüzler üzerinden** gerçekleşir:

```
Input Layer   →[InputCommand]→   Simulation
Simulation   →[RenderSnapshot]→  Render
Simulation   →[AudioEvent]→      Audio
Simulation   →[ReplayFrame]→     Replay
```

Bir katman diğerinin iç state'ine **doğrudan erişemez**.

---

## 4. Geliştirme Protokolü

Her geliştirme görevi şu adımları takip eder.

### Adım 1: Katmanı Tanımla

Görev başlamadan önce yaz:

```
Katman    : [core / input / gameplay / systems / render / audio / app]
Sorumluluk: Bu değişiklik ne yapıyor?
Sınır     : Bu değişiklik neye dokunmuyor?
```

Eğer bu üçü net değilse göreve başlama.

### Adım 2: Checklist

Her geliştirme öncesi:

- [ ] Hangi katmandayım?
- [ ] Bu değişiklik determinism'i bozuyor mu?
- [ ] Bu değişiklik input latency'i artırıyor mu?
- [ ] Core loop'a (collision timing, player angle, fixed step) dokunuyor mu?
- [ ] Bu değişiklik debug edilebilir mi?
- [ ] Replay sistemi bu değişikliği yakalayabilir mi?

### Adım 3: Değişiklik Boyutu Kuralı

```
Küçük değişiklik  → tek dosya, tek sistem
Orta değişiklik   → tek katman
Büyük değişiklik  → ayrı PR, ayrı review
```

Bir PR hiçbir zaman birden fazla katmana aynı anda dokunmamalıdır.

### Adım 4: Doğrulama

Değişiklik sonrası:

1. Determinism testi çalıştır
2. Latency ölçümü al (input → reaction)
3. Replay test senaryosunu tekrar çalıştır

---

## 5. Sistem Bazlı Kurallar

### 5.1 Input Pipeline

**Doğru akış:**

```
[OS Event] → InputReader → normalize() → InputCommand { angle, timestamp }
                                              ↓
                                     SimulationEngine (tick başında)
```

**Normalizasyon kuralları:**

- Fare pozisyonu → merkeze göre açıya dönüştür (`atan2`)
- Tuş girişi → sabit açı adımına dönüştür
- Timestamp → simulation tick'e round et (deterministik)
- Dead zone uygula (küçük tremor'ları filtrele)

**Yasak:**

```rust
// YANLIŞ — input layer'da smoothing + karar
fn process_input(raw: RawInput) -> PlayerAction {
    let smoothed = self.smooth_angle(raw.angle);  // ✗ smoothing burada değil
    if smoothed > threshold {                      // ✗ karar burada değil
        return PlayerAction::Deflect;
    }
}

// DOĞRU — yalnızca normalize
fn process_input(raw: RawInput) -> InputCommand {
    InputCommand {
        angle: normalize_angle(raw.position, screen_center),
        timestamp: raw.timestamp,
    }
}
```

---

### 5.2 Collision Sistemi

**Koordinat modeli:** Polar (angle + radius)

```
Collision koşulları (İKİSİ BİRDEN sağlanmalı):
  1. radial_distance(threat, player_ring) < RADIAL_TOLERANCE
  2. angular_distance(threat.angle, player.angle) < ANGULAR_TOLERANCE
```

**Tolerance sabitleri:**

```rust
const RADIAL_TOLERANCE: f32  = 8.0;   // piksel cinsinden
const ANGULAR_TOLERANCE: f32 = 0.15;  // radyan cinsinden (~8.5°)
```

Bu değerler oyun tasarımcısı kararıdır, kod değil. Bir dosyada sabit olarak yaşar, dağıtık değil.

**Yasak:**

```rust
// YANLIŞ — frame-dependent collision
fn check_collision(&self, dt: f32) -> bool {
    let effective_radius = self.radius * dt;  // ✗ dt'ye bağımlı
    ...
}

// YANLIŞ — floating point birikimi
self.angle += delta;  // ✗ her frame birikir
// DOĞRU
self.angle = (initial_angle + total_delta).rem_euclid(TAU);
```

**Coyote Window (Fairness Mekanizması):**

Oyuncu tuşa bastığında collision check FIXED_STEP'ten biraz geniş bir pencerede değerlendirilir:

```rust
const COYOTE_FRAMES: u32 = 2;  // ±2 tick tolerans
```

Bu, "bastım ama olmadı" hissini ortadan kaldırır. Sayıyı artırma — fairness ile challenge dengesi bozulur.

---

### 5.3 Spawn Sistemi

**Yasak:** `rand::random()` doğrudan çağrısı

**Doğru:** Seed tabanlı PRNG + constraint

```rust
struct SpawnOrchestrator {
    rng: SmallRng,          // seed'den türetilmiş
    constraint: SpawnConstraint,
}

struct SpawnConstraint {
    min_angle_gap: f32,     // son spawn'dan minimum açı farkı
    cooldown_ticks: u32,    // minimum bekleme süresi
    max_simultaneous: u8,   // ekrandaki maksimum tehdit
}
```

**Spawn kararı akışı:**

```
tick() → rng.next() → constraint_check() → SpawnEvent veya Skip
```

Constraint geçemezse o tick spawn olmaz. Rastgelelik kontrollüdür.

---

### 5.4 Difficulty Sistemi

**Artan parametreler (sırasıyla aktive olur):**

```
Aşama 1 (skor 0-100):    spawn_rate artar
Aşama 2 (skor 100-300):  entity_speed artar
Aşama 3 (skor 300+):     simultaneous_threats artar
```

**Okunabilirlik sınırı:**

Her aşamada şu soruyu sor:

> "Ortalama bir oyuncu bu tehdit kombinasyonunu 200ms içinde okuyabilir mi?"

Eğer hayır → difficulty eğrisini geri çek.

**Yasak:** Birden fazla parametreyi aynı anda sert değiştirmek.

---

### 5.5 Skor Sistemi

**Skor yalnızca simulation katmanında hesaplanır.**

```rust
// YANLIŞ — render callback'te skor
fn on_deflect_animation_complete(&mut self) {
    self.score += 10;  // ✗ animasyona bağımlı
}

// DOĞRU — simulation tick'te skor
fn process_collision(&mut self, result: CollisionResult) -> ScoreEvent {
    match result {
        CollisionResult::Deflect { timing_quality } => {
            ScoreEvent { delta: base_score * timing_multiplier(timing_quality) }
        }
        ...
    }
}
```

**Timing multiplier:** Perfect / Good / Late ayrımı skor üretir, gameplay kararı üretmez.

---

## 6. Feedback Tasarımı

### 6.1 Temel Kural

```
Gameplay → Event üretir
Render / Audio → Event'i yorumlar
```

Feedback asla gameplay kararını değiştirmez. Yalnızca bildirir.

### 6.2 Her Feedback Bir Soruya Cevap Verir

| Durum | Soru | Feedback |
|---|---|---|
| Başarılı deflect | "Doğru mu yaptım?" | Parlama + pozitif ses |
| Erken deflect | "Erken mi yaptım?" | Soluk efekt + farklı ses |
| Geç deflect | "Geç mi yaptım?" | Kırmızı flash + uyarı sesi |
| Miss | "Neden kaçırdım?" | Tehdidin geçtiği yerde iz |
| Hit | "Nasıl öldüm?" | Yavaşlama + açıkça bölgeye dikkat |

Bu soruları yanıtlayamayan bir feedback eklenmiş olmamalıdır.

### 6.3 Telegraph Sistemi

Her tehdit görünmeden önce bir uyarı vermelidir:

```
Tehdit doğma zamanı: T=0
Telegraph başlangıcı: T=-600ms  (minimum)
Oyuncunun reaksiyon süresi: ~300ms
Hareket süresi (açı): ~200ms
Güvenli marj: ~100ms
```

Telegraph süresi difficulty ile kısalabilir ama **asla 400ms'nin altına inmemelidir.**

### 6.4 Feedback Katmanı Yok Edilemez

Bir efekt gameplay state'ini değiştiriyor mu? Test et:

```
feedback_test(event) {
    before = simulation.snapshot()
    trigger_feedback(event)
    after = simulation.snapshot()
    assert before == after  // feedback state değiştirmemeli
}
```

---

## 7. Determinism Güvencesi

### 7.1 Tehdit Kaynakları ve Önlemleri

| Tehdit | Önlem |
|---|---|
| Sistem saati | `SystemTime` kullanma, tick sayacı kullan |
| Floating point platform farkı | `f64` kullan, transcendental fonksiyonları sınırla |
| HashMap sıra garantisizliği | `BTreeMap` veya `IndexMap` kullan |
| OS rasgeleliği | `SmallRng::seed_from_u64(seed)` kullan |
| Thread yarışı | Simulation single-threaded, render ayrı thread |
| Dış sistem durumu | Simulation'a dış state sokmaktan kaçın |

### 7.2 Determinism Test Senaryoları

**Senaryo A — Tam Replay:**
```
input_log = kayıt_et(session_1)
replay(seed=session_1.seed, input=input_log)
assert her_frame_snapshot eşit
```

**Senaryo B — Farklı FPS:**
```
run(seed=42, fps=30)  → final_state_A
run(seed=42, fps=144) → final_state_B
assert final_state_A == final_state_B
```

**Senaryo C — Stress Test:**
```
for seed in [0, 1, 42, u64::MAX, ...]:
    run twice with same input
    assert identical
```

### 7.3 Snapshot Yapısı

```rust
#[derive(PartialEq, Debug, Serialize)]
struct SimulationSnapshot {
    tick: u64,
    player_angle: OrderedFloat<f32>,
    threats: Vec<ThreatState>,  // deterministic sırada
    score: u64,
    rng_state: [u64; 4],        // SmallRng iç state
}
```

---

## 8. Performans Bütçesi ve Latency Yönetimi

### 8.1 Latency Bütçesi

```
Input Event → Simulation → Render → Ekran
     ↑              ↑          ↑
   <1ms           <16ms      <8ms
         Toplam: < 25ms hedef
```

**Input latency 50ms'yi geçerse oyun hissiyat olarak başarısızdır.**

### 8.2 Kritik Path

Bu yolu asla geciktirme:

```
OS Input Event
    ↓ (< 1ms)
InputProcessor.normalize()
    ↓ (< 1ms)
SimulationEngine.apply_input()
    ↓ (< 1ms)
Collision Check
    ↓ (< 1ms)
GameEvent Buffer'a yaz
```

Bu zincirde herhangi bir I/O, lock, veya async await → **reddet**.

### 8.3 Kritik Olmayan Path

Bu işlemler gecikebilir, ana thread'i bloklamamalı:

- Shader derleme
- Ses dosyası yükleme
- Analytics yazma
- Replay kaydetme

### 8.4 Frame Bütçesi (60Hz hedef)

```
Simulation update:   ≤ 2ms
Collision check:     ≤ 1ms
Render snapshot:     ≤ 1ms
GPU upload:          ≤ 4ms
Draw calls:          ≤ 4ms
Audio mix:           ≤ 2ms
Toplam:             ≤ 14ms  (6ms marj)
```

### 8.5 Profiling Kuralı

Optimizasyon yapmadan önce ölç. Varsayıma göre optimize etme.

```rust
// Her sistem kendi süresini loglayabilmeli
struct SystemTimer {
    name: &'static str,
    start: Instant,
}

impl Drop for SystemTimer {
    fn drop(&mut self) {
        let elapsed = self.start.elapsed();
        if elapsed > WARN_THRESHOLD {
            log::warn!("{} took {:?}", self.name, elapsed);
        }
    }
}
```

---

## 9. Test ve Debug Stratejisi

### 9.1 Test Katmanları

| Test Türü | Hedef | Araç |
|---|---|---|
| Unit | Bireysel fonksiyon | `#[test]` |
| Integration | Katmanlar arası | `#[test]` + mock boundary |
| Determinism | Replay tutarlılığı | Özel test binary |
| Performance | Latency ve frame süresi | criterion, pprof |
| Fairness | Collision window doğruluğu | Input inject + verify |

### 9.2 Bug Debug Protokolü

Bug bulunduğunda:

```
1. Replay dosyasını aç
2. Aynı seed + input ile tekrar çalıştır
3. Bug tekrarladı mı?
   → Evet: simulation bug → core/gameplay katmanında bak
   → Hayır: determinism bozulmuş → 7.1'e git
4. En erken hatalı tick'i bul (binary search ile)
5. O tick'te state'i incele
```

Replay olmadan bug debug'lamak yasaktır.

### 9.3 Test Edilemez Kod Yasağı

Her yeni sistem için şunu sor:

> "Bu sisteme izole bir input verebilir miyim ve output'u doğrulayabilir miyim?"

Eğer hayır → sistemin tasarımı yanlış. Yeniden tasarla.

### 9.4 Debug Overlay

Development build'de her zaman aktif olmalı:

```
[F1]  Collision hitbox görselleştirme
[F2]  Input angle göstergesi
[F3]  Tick counter ve simulation time
[F4]  Spawn pattern görselleştirme
[F5]  Current difficulty parametreleri
[F6]  Frame time grafiği
```

---

## 10. Geliştirme Aşamaları (Milestone Planı)

### Milestone 0 — Temel Kurulum

**Hedef:** Çalışan bir loop, hiç gameplay yok.

- [ ] Tauri projesi ayağa kaldır
- [ ] wgpu context oluştur
- [ ] Fixed timestep game loop çalışıyor
- [ ] Input okuma ve normalize çalışıyor
- [ ] Determinism testi (boş simulation)

**Kapanış kriteri:** `cargo test` geçiyor, loop 60Hz sabit çalışıyor.

---

### Milestone 1 — Core Mekanik

**Hedef:** Oynanabilir ama çirkin prototype.

- [ ] Merkez nokta render
- [ ] Player açısı (fare/tuş ile kontrol)
- [ ] Tek tehdit türü (radyal hareket)
- [ ] Collision detection (polar)
- [ ] Deflect vs hit ayrımı
- [ ] Ekrana basit skor

**Kapanış kriteri:** Farklı FPS'lerde aynı collision sonucu. Determinism testi geçiyor.

---

### Milestone 2 — Fairness Katmanı

**Hedef:** "Bastım ama olmadı" hissini ortadan kaldır.

- [ ] Coyote window implementasyonu
- [ ] Telegraph sistemi (uyarı görselleştirme)
- [ ] Timing kalitesi ölçümü (perfect/good/late)
- [ ] Temel feedback (renk ve ses ayrımı)
- [ ] Input latency ölçümü ve log

**Kapanış kriteri:** Playtester "bastım ama olmadı" demeden 5 dakika oynuyor.

---

### Milestone 3 — Difficulty ve Progression

**Hedef:** Oyun zorlaşıyor ve bu okunaklı.

- [ ] Spawn orchestrator (seed tabanlı)
- [ ] Difficulty eğrisi (3 aşama)
- [ ] Birden fazla eşzamanlı tehdit
- [ ] Skor çarpanı (timing kalitesi bazlı)
- [ ] Telegraph süresi difficulty ile uyumlu

**Kapanış kriteri:** Skor 300'e ulaşana kadar progression okunaklı.

---

### Milestone 4 — Replay ve Persistence

**Hedef:** Her session tekrar oynanabilir ve analiz edilebilir.

- [ ] Replay kayıt sistemi (seed + input log)
- [ ] Replay playback
- [ ] Highscore kayıt
- [ ] Debug overlay tamamlanmış

**Kapanış kriteri:** Herhangi bir session replay edildiğinde frame-perfect eşleşiyor.

---

### Milestone 5 — Polish

**Hedef:** Hissiyat tamamlanmış.

- [ ] Shader efektleri (gameplay'i etkilemeden)
- [ ] Ses tasarımı tamamlanmış
- [ ] Menü ve lifecycle
- [ ] Performans optimizasyonu (bütçe aşılıyorsa)

**Kapanış kriteri:** Playtester tekrar oynuyor.

---

## 11. Anti-Pattern Katalogu

Bu bölüm geçmişte veya tasarım aşamasında görülen hataları belgeler.

### AP-01: Render'da Gameplay Kararı

```rust
// YANLIŞ
fn draw_threat(&mut self, threat: &Threat) {
    if self.is_overlapping_player(threat) {
        self.score += 1;  // ✗ render'da skor
        self.play_sound("hit");  // ✗ render'da ses tetikleme
    }
    // ...çiz
}
```

**Neden yanlış:** Render FPS'e bağımlı, determinism bozulur.  
**Düzeltme:** Collision gameplay katmanında işlenir, render yalnızca `RenderSnapshot` okur.

---

### AP-02: Input Layer'da Smoothing + Karar

```rust
// YANLIŞ
fn update_input(&mut self, raw: f32) {
    self.smoothed_angle = lerp(self.smoothed_angle, raw, 0.1);  // ✗ smoothing
    if self.smoothed_angle > threshold {                         // ✗ karar
        self.fire();
    }
}
```

**Neden yanlış:** Smoothing gecikme ekler, karar input layer'da olmaz.  
**Düzeltme:** Normalize et ve ilet. Smoothing render katmanında görsel amaçlı yapılabilir.

---

### AP-03: dt'ye Bağımlı Collision

```rust
// YANLIŞ
fn check(&self, dt: f32) -> bool {
    self.pos + self.vel * dt  // ✗ frame süresine bağımlı konum
}
```

**Neden yanlış:** Farklı frame rate'lerde farklı collision sonucu.  
**Düzeltme:** Fixed timestep içinde sabit adımlarla güncelle.

---

### AP-04: Sonsuz Rastgelelik

```rust
// YANLIŞ
fn spawn_threat(&mut self) {
    let angle = rand::random::<f32>() * TAU;  // ✗ seed'siz
}
```

**Neden yanlış:** Replay çalışmaz, determinism bozulur.  
**Düzeltme:** `SmallRng::from_seed(self.seed)` kullan.

---

### AP-05: Overengineered ECS

```
// YANLIŞ — bu oyun için
Entity → Component<Position> + Component<Velocity> + Component<Collidable> + ...
         + System<MovementSystem> + System<CollisionSystem> + ...
```

**Neden yanlış:** Bu oyun az entity, yüksek hassasiyet gerektiriyor. ECS overhead fazladan complexity.  
**Düzeltme:** Düz struct'lar ve sabit boyutlu array'ler yeterli.

---

### AP-06: Feedback'in State Değiştirmesi

```rust
// YANLIŞ
fn play_deflect_animation(&mut self) {
    self.animation_timer = 0.5;
    self.player.invincible = true;  // ✗ feedback gameplay state değiştirdi
}
```

**Neden yanlış:** Feedback mekanizması gameplay avantajı haline geldi.  
**Düzeltme:** Invincibility frames oyun kuralı olarak gameplay katmanında tanımlanır, feedback'ten bağımsız.

---

## 12. Karar Çerçevesi

Yeni bir özellik veya değişiklik geldiğinde şu soruları sırayla sor:

### Soru 1: Core loop'u bozuyor mu?

> "Bu değişiklik açı kontrolü, timing veya collision davranışını değiştiriyor mu?"

- Eğer **değiştiriyorsa** → çok dikkatli, playtesti zorunlu
- Eğer **değiştirmiyorsa** → devam et

---

### Soru 2: Hangi katman?

> "Bu kod nerede yaşamalı?"

Katman belirsizse → en kısıtlı katmanı seç (gameplay yerine systems, systems yerine render).

---

### Soru 3: Determinism bozuluyor mu?

> "Bu değişiklikten sonra aynı input aynı sonucu üretir mi?"

- Eğer **emin değilsem** → determinism bozulmuştur, değişikliği reddet.

---

### Soru 4: Latency artıyor mu?

> "Bu kod input → reaction zincirinde mi? Gecikme ekliyor mu?"

- Eğer **evet** → reddet veya zincir dışına taşı.

---

### Soru 5: Test edilebilir mi?

> "Bu değişikliği izole olarak doğrulayabilir miyim?"

- Eğer **hayır** → tasarım yanlış, yeniden düşün.

---

### Soru 6: Debug edilebilir mi?

> "Bu sistem hata ürettiğinde replay ile tekrar üretebilir miyim?"

- Eğer **hayır** → replay hook ekle veya yapıyı değiştir.

---

### Hızlı Karar Matrisi

| Değişiklik Türü | Risk | Onay Gereksinimi |
|---|---|---|
| Shader / görsel efekt | Düşük | Tek kişi |
| Ses feedback | Düşük | Tek kişi |
| Spawn pattern | Orta | Playtesti |
| Difficulty eğrisi | Orta | Playtesti |
| Collision tolerance | Yüksek | Playtest + determinism testi |
| Fixed timestep | Kritik | Tüm testler + review |
| Input normalizasyon | Kritik | Tüm testler + review |

---

## Appendix: Kritik Sabitler

Bu sabitler oyun tasarımının merkezindedir. Dağıtık olarak kodda yaşayamaz; tek bir dosyada tanımlanır.

```rust
// src/core/constants.rs

// Simulation
pub const FIXED_STEP: f64         = 1.0 / 60.0;
pub const MAX_STEPS_PER_FRAME: u32 = 5;

// Collision
pub const RADIAL_TOLERANCE: f32   = 8.0;   // px
pub const ANGULAR_TOLERANCE: f32  = 0.15;  // radyan (~8.5°)
pub const COYOTE_FRAMES: u32      = 2;

// Fairness
pub const MIN_TELEGRAPH_MS: u32   = 400;
pub const REACTION_WINDOW_MS: u32 = 300;

// Difficulty
pub const SPAWN_RATE_BASE: f32    = 2.0;   // tehdit/saniye
pub const SPEED_BASE: f32         = 120.0; // px/saniye
pub const MAX_SIMULTANEOUS: u8    = 6;

// Scoring
pub const SCORE_PERFECT: u64      = 15;
pub const SCORE_GOOD: u64         = 10;
pub const SCORE_LATE: u64         = 5;
```

Bu değerlerden herhangi biri değiştirildiğinde playtesti zorunludur. Değer değişikliği commit mesajında gerekçelendirilmelidir.

---

*Bu doküman oyunun geliştirme süreci boyunca yaşayan bir belgedir. Milestone kapandıkça ilgili bölümler güncellenir.*
