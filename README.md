# Victor Ferreira — Portfólio · Cidade viva

Portfólio interativo em 3D: uma cidade em maquete branca que se monta conforme a pessoa avança.
Arquitetura (obras com as pranchas reais), eventos (palco, LED e público à noite),
apps em feed dentro de um totem e tecnologia no telão de LED.

- Three.js puro, geometria gerada em código (instancing), animação no shader
- Um único número (o progresso) dirige cidade, câmera e luz; hora do dia contínua
- Editor de câmeras em `?camera` (órbita ou caminhada WASD), grava em `src/shots.json`

```bash
npm install
npm run dev     # http://localhost:5173
npm run build
```

Conteúdo em `src/content.json`, `src/tech.json` e `public/content/`.
Créditos de cada projeto às empresas parceiras (F2 Solutions, RG Produções, TM1 Brand Experience, Musik Pro, AIdeas Lab).
