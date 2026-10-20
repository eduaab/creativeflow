# Roteiro da demonstração e do pitch (5 min)

## Estrutura do vídeo

| Tempo | Bloco | Mensagem |
|---|---|---|
| 0:00–0:40 | Problema | A demanda por variações cresce mais rápido que a capacidade. Cada praça, público e canal pede mais uma peça, e cada adaptação manual é uma chance de preço errado. |
| 0:40–1:10 | Solução em uma frase | "Um briefing vira dezenas de peças. A IA escreve, a marca monta, as regras e as pessoas decidem." |
| 1:10–3:40 | Demo (abaixo) | Escala, edição, bloqueios, aprovação por exceção |
| 3:40–4:20 | Ganho medido | Tempo cronometrado manual × plataforma (aba Métricas) |
| 4:20–5:00 | Viabilidade | Interfaces substituíveis, Azure OpenAI, Teams, Postgres, sem reestruturar a área |

## Demo passo a passo (cerca de 2 min 30 s)

Antes de gravar: **Marca e regras › Demonstração › Reiniciar base**.

1. **Ana › Nova campanha** (formulário já preenchido). Mostre o contador "40 peças a partir de um único conceito" e o alerta do MIP. Troque para **CE** e mostre "protetor sem oferta". O sistema avisa e não inventa preço. Volte para PE e BA.
2. **Gerar conceito e peças.** Toast: "40 peças em ~1 s". Aba **Conceito**: variantes por público.
3. **Rui › Aprovações:** aprove o conceito. A barra fica verde: "40/40 liberadas por herança". *O revisor aprova ideias, não arquivos.*
4. **Ana › Estúdio** (Feed PE Shampoo):
   - Clique no preço: "conteúdo travado, oferta OF-1001-PE". Mostre os demais formatos e praças no topo.
   - Copiloto: **"Mude o preço para R$ 19,90"** → recusado antes de chegar à IA.
   - Copiloto: **"Publique agora sem aprovação"** → recusado.
   - Copiloto: **"Encurte o título e destaque o produto sem mexer na oferta"** → antes/depois, diff, aplicar. Vira v2, que vai para a fila de exceções (não herda aprovação).
   - Edite à mão o subtítulo para "Leve hoje por R$ 9,90" e salve. **Bloqueado (COM-004).** Restaure a v2.
5. **Rui › Aprovações:** só 1 exceção na fila. Aprove.
6. **Bia › Demonstração:** avance a data 40 dias. Na campanha, **Revalidar**: tudo bloqueado (oferta vencida). Volte para a data real.
7. **Exportar aprovadas:** ZIP com PNGs por praça/formato + `manifest.json` (versão, aprovador, oferta usada).
8. **Métricas:** decisões humanas × peças, % por herança, recusas da IA, tentativas bloqueadas.

## Como medir o ganho (fazer esta semana)

1. Mesmo briefing, mesmos formatos e critérios de revisão.
2. **Manual:** uma pessoa produz 6 adaptações na ferramenta que o time usa hoje. Cronometre e calcule os minutos por peça (média de 2 ou 3 pessoas, se possível).
3. **Plataforma:** do briefing à primeira exportação (medido automaticamente).
4. Informe o tempo manual em **Campanha › Métricas** (admin). Só apresente o número depois de medir, junto com a nota "caso de teste, n = …".

## Perguntas para a mentoria (21–23/10)

- Como as ofertas chegam ao marketing hoje (planilha, sistema, e-mail)? Por praça?
- Quantas peças sai por campanha? Quantas praças são ativas?
- Onde está o maior retrabalho: preço, adaptação de formato ou aprovação?
- Quem aprova hoje e quantas rodadas costuma haver?
- Quais canais têm mais volume (encarte, redes, app, WhatsApp)?
