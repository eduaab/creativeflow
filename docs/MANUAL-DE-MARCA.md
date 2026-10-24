# Manual de marca sintético, a partir de estudo público

O desafio pede um manual construído **a partir da observação de materiais públicos**, com o critério documentado.
Este arquivo é esse registro. O código lê **apenas** `packages/shared/src/brand/brand.ts`; trocar a marca é editar esse arquivo.

> **Estado atual (`2026.10-estudo-v2`)**: paleta, tipografia, grafismos e tom **aproximados** da identidade pública do cliente
> (versão apresentada em 2025). **Nome ("Farmácia Exemplo"), logo, slogans, produtos e preços continuam fictícios.**
> Nada aqui é arquivo oficial, vetor de logo ou diretriz interna da marca.

## 1. Por que sintético, e por que "inspirado"

| Opção | Problema |
|---|---|
| Copiar logo, nome e slogan reais | Uso de marca de terceiros num repositório e num vídeo públicos; o desafio é confidencial. |
| Marca 100% genérica (versão 1) | A banca não reconhece o cliente nas peças; parece um produto de prateleira. |
| **Sintético inspirado no estudo (escolhida)** | As peças "parecem" o cliente (cores, formas, tom), sem reproduzir ativos protegidos. Quando houver o manual oficial, só `brand.ts` muda. |

## 2. Método

1. **Coleta:** reportagens de lançamento da identidade visual, página pública do programa de fidelidade, notícias de campanhas (aniversário, datas regionais, varejo físico) e uma referência pública dos códigos de cor do logo anterior.
2. **Extração:** cores, forma do símbolo, característica da tipografia, estilo de grafismo e fotografia, tom de voz e vocabulário de chamada para ação.
3. **Consolidação:** só entra no manual o que aparece em mais de uma fonte. O que é dedução nossa está marcado como **aproximação**.
4. **Limite:** sem logos vetorizados, sem fontes proprietárias, sem slogans reais nas peças.

## 3. Observações públicas

| # | O que foi observado | Fonte | Como virou token ou regra |
|---|---|---|---|
| 1 | Identidade de 2025 mantém **vermelho e azul**, agora em tons **mais vivos e luminosos** | Grandes Nomes da Propaganda; Central do Varejo | `primary` azul vivo e `accent` vermelho vivo |
| 2 | Códigos do logo anterior: azul `#175FA6`, vermelho `#ED1C24` | WhatTheLogo | Ponto de partida; clareamos o azul e ajustamos o vermelho para contraste com branco ≥ 4,5:1 |
| 3 | Símbolo com **traços arredondados**, sugerindo leveza, empatia e proximidade; o **contorno** do símbolo virou elemento da identidade | idem 1 | Logo fictício com disco + contorno; fundos com círculos; cantos arredondados no preço e no CTA |
| 4 | Tipografia **arredondada, não itálica**, com contraformas amplas para leitura em tamanho pequeno | idem 1 | Títulos em **Nunito** (livre, arredondada), substituta da fonte proprietária; textos em Inter |
| 5 | Fotografia **quente e vibrante**, vida real, fora do ambiente da farmácia | idem 1 | Diretriz para a futura geração de fundos; hoje os fundos são procedurais |
| 6 | Tom **acolhedor, humano, otimista, "alto astral"**; "levar saúde com amor"; foco em proximidade, cuidado e saúde acessível | idem 1; Marcas pelo Mundo (posicionamento de 2026) | `BRAND_VOICE.tone` e exemplos aprovados (todos escritos por nós) |
| 7 | Fidelidade com **níveis** e ofertas personalizadas pelo histórico (CPF) | Página pública do programa; Meio & Mensagem | Público "fidelidade" e selo em **ouro** (`sun`); o nome continua fictício ("Clube Exemplo") |
| 8 | Campanhas sazonais e regionais (São João, Carnaval) com foco em **saúde nas festas** | Nosso Meio | Novo tema no modo demonstração ("Festa com cuidado"), sem estereótipo regional |
| 9 | CTAs diretos e curtos ("Cadastre-se", "Comece a pontuar") | Página do programa | CTA padrão de até 3 palavras ("Compre no app") |

## 4. Tokens e justificativa

| Token | Valor | Contraste com branco | Por quê |
|---|---|---|---|
| `primary` | `#1A62C4` | 5,9:1 | Azul vivo (obs. 1 e 2); faixa, CTA, símbolo |
| `primaryDark` | `#0D3F86` | 10,1:1 | Títulos sobre fundo claro |
| `primarySoft` | `#DCE9FB` | — | Blocos e círculos de fundo |
| `accent` | `#E3202B` | 4,7:1 | Vermelho vivo do preço: etiqueta "De/Por" chama atenção sem perder legibilidade |
| `accentSoft` | `#FDE1E2` | — | Círculos atrás do produto |
| `sun` | `#FFC72C` | texto `ink` 10:1 | Selo do Clube (nível "ouro") e CTA sobre a faixa azul |
| `ink` / `muted` | `#14213D` / `#46536B` | 16:1 / 7,8:1 | Texto e textos secundários |
| Títulos | Nunito 700/800 | — | Arredondada, não itálica (obs. 4) |
| Texto | Inter | — | Leitura em corpo pequeno (vigência, advertência) |

Todas as combinações de formato × layout × fundo continuam passando nas regras de contraste e área segura (testes em `packages/shared/test`).

## 5. Tom de voz (enviado à IA em todo pedido)

- Acolhedor, humano e otimista. Fala de cuidado de perto, no dia a dia real.
- Saúde acessível e próxima: a farmácia como parceira, sem linguagem de bula.
- Frases curtas, imperativo gentil; pode usar "a gente" e falar com "você".
- Economia como benefício para a família, nunca como grito de preço.
- Sem superlativos absolutos, sem promessa de resultado de saúde, no máximo uma exclamação.

**Exemplos aprovados (fictícios):** "Cuidar de você faz parte do nosso dia", "Saúde pertinho de você, todo dia", "Seu autocuidado com a gente do lado".
**Exemplos proibidos:** "O MELHOR PREÇO DO BRASIL!!!", "Cura a queda de cabelo", "Corra, é só hoje!!!".

Termos proibidos e alegações que exigem autorização são configuráveis em *Marca e regras* e versionados.

## 6. Como o manual vira governança

| Manual | Regra no código |
|---|---|
| Paleta fechada | `MAR-002` crítico; editor e IA só aceitam tokens |
| Logo obrigatório e tamanho mínimo | `MAR-001` |
| Termos proibidos | `MAR-004` crítico |
| Tom (exclamações, caixa alta) | `MAR-005` informativo |
| Contraste mínimo | `FMT-004` |
| Área segura por canal | `FMT-002` |

## 7. O que muda com o manual oficial

Trocar em `brand.ts`: códigos de cor exatos, fonte oficial (se licenciada para uso web), logo vetorial e exemplos de tom
aprovados pela equipe de marca. Templates, regras, editor e IA não precisam mudar.

## Fontes (acesso em 24/10/2026)

- Grandes Nomes da Propaganda: nova identidade visual (02/05/2025) — <https://grandesnomesdapropaganda.com.br/anunciantes/pague-menos-apresenta-nova-identidade-visual/>
- Central do Varejo: nova identidade visual — <https://centraldovarejo.com.br/pague-menos-apresenta-nova-identidade-visual/>
- Marcas pelo Mundo: 45 anos e novo posicionamento (2026) — <https://marcaspelomundo.com.br/anunciantes/pague-menos-celebra-45-anos-com-juliette-e-lanca-novo-posicionamento-institucional/>
- WhatTheLogo: cores do logo anterior — <https://whatthelogo.com/logo/farmacia-pague-menos/150984>
- Página pública do programa de fidelidade — <https://www.paguemenos.com.br/programa-de-fidelidade>
- Meio & Mensagem: descontos personalizados — <https://www.meioemensagem.com.br/ultimas-noticias/pague-menos-cria-programa-de-descontos-personalizados>
- Nosso Meio: campanha de São João — <https://nossomeio.com.br/pague-menos-estreia-campanha-de-sao-joao-e-destaca-a-saude-em-momentos-de-festividades/>
