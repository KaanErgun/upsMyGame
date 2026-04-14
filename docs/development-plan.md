# Orbit Deflect — Geliştirme Planı

**Oluşturulma:** 2026-04-12  
**Durum:** Aktif

---

## Faz 0: Proje İskeleti ve Temel Altyapı

> **Hedef:** Çalışan bir game loop, hiç gameplay yok.  
> **Çıkış Kriteri:** `cargo test` geçiyor, loop 60Hz sabit çalışıyor, boş simulation determinism testi geçiyor.

- [ ] **0.1** Tauri v2 + Rust workspace kurulumu (`Cargo.toml`, workspace members)
- [ ] **0.2** Crate iskeletleri oluştur (`orbit-core`, `orbit-render`, `orbit-input`, `orbit-audio`, `orbit-persist`)
- [ ] **0.3** Temel tipleri tanımla (`Angle`, `SimTick`, `EntityId`, `PolarPos`) — `orbit-core/src/types.rs`
- [ ] **0.4** Polar matematik yardımcıları (`angle delta`, `abs_delta`, `rem_euclid` normalize) — `orbit-core/src/math.rs`
- [ ] **0.5** Seeded RNG wrapper (`SmallRng::seed_from_u64`) — `orbit-core/src/rng/seeded.rs`
- [ ] **0.6** Fixed timestep game loop implementasyonu (60Hz, `MAX_STEPS_PER_FRAME=5`, accumulator modeli)
- [ ] **0.7** `SimulationEngine` boş iskeleti (`new(seed)`, `tick()` döngüsü)
- [ ] **0.8** wgpu context oluşturma + boş pencere açma
- [ ] **0.9** Input okuma altyapısı (OS event → `InputCommand` struct, timestamp)
- [ ] **0.10** Boş simulation determinism testi (aynı seed, iki çalıştırma → aynı state)
- [ ] **0.11** Kritik sabitler dosyası (`constants.rs` — `FIXED_STEP`, toleranslar, scoring sabitleri)

---

## Faz 1: Core Mekanik (Oynanabilir Prototip)

> **Hedef:** Vurulabilen tehditler, çalışan collision, basit skor. Efekt yok, render placeholder.  
> **Çıkış Kriteri:** Tehdit gelir, doğru açıda vurulunca skor artar, kaçırılınca hasar alınır. Farklı FPS'lerde aynı collision sonucu. Determinism testi geçiyor.

- [ ] **1.1** `PlayerState` struct + açı güncelleme (`angular_speed`, `shield_arc`)
- [ ] **1.2** `PlayerSystem` — keyboard input ile açı kontrolü (L/R velocity driven)
- [ ] **1.3** `ThreatEntity` struct (`ThreatKind::Standard`, `PolarPos`, `radial_velocity`)
- [ ] **1.4** `ThreatSystem` — tek tip tehdit, düz radyal yaklaşım (dışarıdan merkeze)
- [ ] **1.5** `CollisionSystem` — polar collision detection (radyal mesafe + açısal delta, iki koşul birden)
- [ ] **1.6** Deflect vs Miss ayrımı (`SHIELD_RADIUS`, `CORE_RADIUS` kontrolleri)
- [ ] **1.7** `HealthSystem` — miss'te hasar, can bitince `PlayerDied` event
- [ ] **1.8** `ScoreSystem` — base puan + combo mekanizması + `combo_to_multiplier`
- [ ] **1.9** `GameEvent` enum tanımı (`ThreatDeflected`, `ThreatMissed`, `PlayerDamaged`, `PlayerDied`, vs.)
- [ ] **1.10** `RenderSnapshot` struct + her tick'te snapshot üretimi
- [ ] **1.11** Placeholder render — arena, player arc, tehditler, skor göstergesi (egui veya basit wgpu)
- [ ] **1.12** `SimulationEngine.tick()` — tam pipeline: input → player → spawn → threats → collision → score → cleanup
- [ ] **1.13** Collision precision unit testleri (açı wrap-around, zone ayrımı)
- [ ] **1.14** Farklı FPS'lerde determinism testi (seed=42, fps=30 vs fps=144 → aynı final state)

---

## Faz 2: Fairness Katmanı

> **Hedef:** "Bastım ama olmadı" hissini ortadan kaldır. Oyuncu her ölümde "bu benim hatam" desin.  
> **Çıkış Kriteri:** Oyuncu 5 dakika "bastım ama olmadı" demeden oynuyor. Determinism + replay testleri geçiyor.

- [ ] **2.1** Mouse input — `SetTargetAngle` mode (`atan2` ile ekran koordinatından açıya dönüşüm)
- [ ] **2.2** `TimingZones` implementasyonu (`perfect: ~5°`, `good: ~10°`, `scrape: ~15°`)
- [ ] **2.3** `DeflectQuality` hesaplama (`compute_quality` fonksiyonu)
- [ ] **2.4** Coyote window implementasyonu (`COYOTE_FRAMES=2`, ±2 tick tolerans)
- [ ] **2.5** Telegraph sistemi — tehdit spawn'dan `MIN_TELEGRAPH_MS=400ms` önce uyarı sinyali
- [ ] **2.6** Timing kalitesi görsel feedback (Perfect → parlama, Good → soluk, Scrape → kırmızı)
- [ ] **2.7** Input latency ölçüm altyapısı (profiling feature flag)
- [ ] **2.8** Continuous collision detection (hızlı tehditler için `needs_continuous_collision` kontrolü)
- [ ] **2.9** `SpawnOrchestrator` — seed tabanlı PRNG + `SpawnConstraint` (min açı farkı, cooldown, max eşzamanlı)
- [ ] **2.10** Anti-frustration spawn kuralları (`is_angle_acceptable`, `find_least_crowded_angle`)
- [ ] **2.11** Replay kaydı başlangıcı (`ReplayHeader` + `ReplayFrame` + seed/input log)
- [ ] **2.12** Temel replay playback + checksum doğrulama (`state_checksum` her 60 tick'te)
- [ ] **2.13** Replay roundtrip determinism testi

---

## Faz 3: Difficulty, Progression ve Feel

> **Hedef:** Oyun zorlaşıyor, bu okunaklı. Arcade hissi oturmuş.  
> **Çıkış Kriteri:** Skor 300'e kadar okunaklı progression. VFX ve ses feedback'i tam. Difficulty fazları çalışıyor.

### 3A — Difficulty ve Spawn Sistemi

- [ ] **3.1** `DifficultySystem` — faz geçiş mantığı (`Tutorial → Pressure → Escalation → Chaos`)
- [ ] **3.2** Faz parametreleri (`PHASE_PARAMS` — `spawn_interval`, `max_concurrent`, `speed_mult`)
- [ ] **3.3** Sürekli pressure artışı (faz içi `pressure_level` eğrisi)
- [ ] **3.4** Anti-frustration: 3 üst üste miss'te spawn yavaşlatma
- [ ] **3.5** `PatternLibrary` — spawn pattern'ları (Pincer, Spread, vs.)
- [ ] **3.6** Birden fazla eşzamanlı tehdit desteği
- [ ] **3.7** Skor çarpanı — timing kalitesi + difficulty pressure bonus
- [ ] **3.8** Survival bonus (her 10 saniyede `multiplier * 200`)
- [ ] **3.9** Telegraph süresi difficulty ile kısalma (ama asla < 400ms)

### 3B — Render Pipeline (wgpu)

- [ ] **3.10** wgpu render pipeline kurulumu (shader derleme, vertex layout)
- [ ] **3.11** Sahne çizimi — arena, player arc, tehditler (wgsl shaderlar: `arc.wgsl`, `threat.wgsl`)
- [ ] **3.12** Render interpolasyonu (iki snapshot arası `alpha` ile smooth geçiş, açı wrap-around korumalı)
- [ ] **3.13** HUD — skor, combo göstergesi, can barı

### 3C — VFX Sistemi

- [ ] **3.14** `VFXSystem` — `GameEvent` listesinden VFX üretimi
- [ ] **3.15** Hit flash efekti (quality'ye göre yoğunluk)
- [ ] **3.16** Radial shockwave (deflect anında)
- [ ] **3.17** Combo aura efekti (combo seviyesine göre)
- [ ] **3.18** Screen shake (hasar alındığında, ölümde)
- [ ] **3.19** Death distortion efekti
- [ ] **3.20** Threat telegraph görseli (yaklaşan tehdit uyarısı)

### 3D — Audio Sistemi

- [ ] **3.21** Audio altyapısı kurulumu (kira veya cpal)
- [ ] **3.22** `AudioEvent` pipeline (simulation → audio layer)
- [ ] **3.23** SFX: deflect (quality'ye göre farklı ses), miss, death
- [ ] **3.24** Dinamik müzik sistemi — layer tabanlı (BaseAmbient, Rhythm, Percussion, Tension, Melody)
- [ ] **3.25** Combo escalate/break ses geçişleri
- [ ] **3.26** Danger pulse (yakın tehdit yoğunluğuna göre)

---

## Faz 4: İleri Tehdit Tipleri ve Mekanikler

> **Hedef:** Oyun derinliği artıyor, yeni tehdit tipleri okunaklı şekilde devreye giriyor.  
> **Çıkış Kriteri:** Tüm tehdit tipleri çalışıyor, her birinin telegraph'ı ve feedback'i var.

- [ ] **4.1** `ThreatKind::Fast` — yüksek hız, dar zamansal pencere
- [ ] **4.2** `ThreatKind::Narrow` — dar hit window (collision_radius küçük)
- [ ] **4.3** `ThreatKind::Wobble` — açısal salınım (`wobble_phase`, `wobble_amplitude`)
- [ ] **4.4** `ThreatKind::Splitter` — çarpışınca ikiye bölünme
- [ ] **4.5** `ThreatKind::Boomerang` — yanlış açıda geri dönme
- [ ] **4.6** Her yeni tehdit tipi için özel telegraph + VFX + SFX
- [ ] **4.7** Difficulty fazlarına göre tehdit tipi ağırlıklı seçim (`pick_threat_kind`)
- [ ] **4.8** Yeni spawn pattern'ları (ileri tehdit tipleriyle kombine)

---

## Faz 5: State Machine, Persistence ve Polish

> **Hedef:** Oyun bitirilebilir, paylaşılabilir, tekrar oynanabilir.  
> **Çıkış Kriteri:** Tam lifecycle çalışıyor. Leaderboard kaydediliyor. Replay tamamlanmış. Paket hazır.

### 5A — State Machine ve UI

- [ ] **5.1** `GameState` enum — `Boot → Menu → PreGame → InGame → Paused → GameOver`
- [ ] **5.2** State geçiş mantığı (`StateEvent` ile transition)
- [ ] **5.3** Menü ekranı (Play, Settings, Quit)
- [ ] **5.4** PreGame countdown
- [ ] **5.5** Pause / Resume
- [ ] **5.6** Game Over ekranı — skor özeti (final score, perfect/good/scrape dağılımı, max combo, survival süresi)

### 5B — Persistence

- [ ] **5.7** `SessionRecord` kayıt sistemi (JSON, `~/.orbit-deflect/sessions/`)
- [ ] **5.8** Yerel leaderboard (top 10 skor)
- [ ] **5.9** Replay kayıt tamamlama (binary format, `bincode`)
- [ ] **5.10** Replay oynatma UI'ı
- [ ] **5.11** Settings persistence (settings.json)

### 5C — Debug ve Profiling

- [ ] **5.12** Debug overlay (`F1`-`F6` kısayolları: hitbox, input angle, tick, spawn, difficulty, frame time)
- [ ] **5.13** `SystemTimer` — her sistem için süre ölçümü ve uyarı
- [ ] **5.14** Input latency profiler report (avg, p99)
- [ ] **5.15** Telemetri toplama (`miss_angle_histogram`, `input_device`, `difficulty_at_death`)

### 5D — Final Polish ve Paketleme

- [ ] **5.16** Performans optimizasyonu (frame bütçesi aşılıyorsa)
- [ ] **5.17** Chaos fazı balancing (playtest metrikleriyle)
- [ ] **5.18** Tauri paketleme — macOS (.dmg) + Windows (.msi)
- [ ] **5.19** Son determinism stress testi (çoklu seed, çoklu platform)
- [ ] **5.20** Release build doğrulama

---

## Doğrulama Kontrol Listesi (Her Faz Sonunda)

Her fazın kapanışında şunlar sağlanmalıdır:

| Kontrol | Açıklama |
|---------|----------|
| Determinism | `run(seed=42, input=A)` iki kez → aynı snapshot |
| FPS Bağımsızlık | 30 FPS ve 144 FPS'te aynı simulation sonucu |
| Latency | Input → simulation < 10ms, toplam < 50ms |
| Replay | Kayıt + geri oynatma → frame-perfect eşleşme |
| Core Loop | Açı + Timing + Collision bozulmamış |
| Feedback | Render/audio hiçbir gameplay state'ini değiştirmiyor |

---

*Bu plan oyun geliştirme sürecinde yaşayan bir belgedir. Faz tamamlandıkça güncellenir.*
