# Water Digital Twin · Article 2

Live site: https://boukoftanebilal.github.io/water-digital-twin/

This site is an interactive digital twin of the five water-infrastructure testbeds used in Article 2:

- HAI 23.05
- SKAB
- Smart-Farm-IDS
- WDSEventDB
- GECCO 2018

The article is *Graph Neural Networks versus Tabular Foundation Models for Label-Scarce Anomaly Detection in Water Infrastructure: A Comparison on Five Datasets*, by B. Boukoftane, J. M. Navarro Ruiz and A. Pita Lozano. It is a manuscript in preparation (v0.5), so the results may change before publication.

## Replay

The twin replays the real evaluation period of each dataset through animated models of the plant, in a 2D SCADA-style schematic or a 3D scene.

- You choose any detector of the article: TabPFN (v1 and v2), TabICL, gradient boosting, DevNet, Deep SAD, the GNN on the process, correlation or no graph, and the zero-label references.
- You also choose its label budget, its label draw and its threshold.
- The site shows the run's recorded anomaly scores, alarms and detections as they happen.
- Event recall, window precision, event F1, false alarms per hour and delay are computed live with the article's definitions.
- At the end of the period these values reproduce the article's numbers. The exception is 7 of the 1,055 runs, all gradient boosting, where a few stored float32 scores round across the threshold.

## What-if lab

The lab injects synthetic faults into the replayed stream: leaks, frozen or spoofed sensors, forced actuators and drifts.

Three detectors run in the browser and react live:

- point deviation;
- PCA residual;
- process-graph residual.

They use the article's causal normal reference and are fitted on the normal record that precedes the evaluation period. A counterfactual fixed reference can be switched on to see why the article uses the causal one.

## Data

The sensor values are aggregated to one tick per 30-s hop (6 min on GECCO 2018). The data come from:

| Dataset | Source | Licence |
|---|---|---|
| HAI 23.05 | NSR | CC BY-SA 4.0 |
| SKAB | Skoltech | GPL-3.0 |
| Smart-Farm-IDS | — | CC BY 4.0 |
| WDSEventDB | — | CC BY 4.0 |
| GECCO 2018 Industrial Challenge | Thüringer Fernwasserversorgung | CC BY 4.0 |

The derived data in `data/` are shared under the same terms.

## Technical

The site is static (HTML, CSS and plain JavaScript) and uses three.js r128, which is vendored in `vendor/`. It was built from the stored per-window scores of the Article 2 v0.5 runs.
