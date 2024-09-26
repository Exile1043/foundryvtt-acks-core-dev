export const augmentTable = (table, html, data) => {
  // Treasure Toggle
  let head = html.find(".sheet-header");
  const flag = table.object.getFlag("acks", "treasure");
  const treasure = flag
    ? "<div class='toggle-treasure active'></div>"
    : "<div class='toggle-treasure'></div>";
  head.append(treasure);

  html.find(".toggle-treasure").click((ev) => {
    let isTreasure = table.object.getFlag("acks", "treasure");
    table.object.setFlag("acks", "treasure", !isTreasure);
  });

  // Treasure table formatting
  if (flag) {
    // Remove Interval
    html.find(".result-range").remove();
    html.find(".normalize-results").remove();

    html.find(".result-weight").first().text("Chance");

    // Replace Roll button
    const roll = `<button class="roll-treasure" type="button"><i class="fas fa-gem"></i> ${game.i18n.localize('ACKS.table.treasure.roll')}</button>`;
    html.find(".sheet-footer .roll").replaceWith(roll);
  }

  html.find(".roll-treasure").click(async (event) => {
    await rollTreasure(table.object, { event: event });
  });
};

async function drawTreasure(table, data) {
  data.treasure = {};
  if (table.getFlag('acks', 'treasure')) {
    for (const result of table.results) {
      const roll = new Roll("1d100");
      // Since version 9, roll.evaluate has been async by default.
      await roll.evaluate();

      if (roll.total <= result.weight) {
        if (result.type === CONST.TABLE_RESULT_TYPES.TEXT) {
          const text = result.getChatText();
          if (text.includes("#")){
            // split input string where first part is dice formula and second part is RollTable UUID
            const splitInput = result.documentId.split("#");
            const embeddedTable = game.tables.get(splitInput[1]);
            await drawMultipleEmbeddedTreasure(embeddedTable, data, splitInput[0]);
          } else {
            data.treasure[result.id] = ({
              img: result.img,
              text: await TextEditor.enrichHTML(text),
            });
          }          
        } else if ((result.type === CONST.TABLE_RESULT_TYPES.DOCUMENT)
                && (result.documentCollection === "RollTable")) {
          const embeddedTable = game.tables.get(result.documentId);
          await drawEmbeddedTreasure(embeddedTable, data);
        }
      }
    }
  } else {
    const results = await table.roll().results;
    results.forEach((result) => {
      const text = TextEditor.enrichHTML(result.getChatText());
      data.treasure[result.id] = {img: result.img, text: text};
    });
  }

  return data;
}

async function drawEmbeddedTreasure(table, data) {
    const roll = await table.roll();
    for(const result of roll.results) {
      const text = result.getChatText();
      data.treasure[result.id] = {
        img: result.img,
        text: await TextEditor.enrichHTML(text),
      };
    }
}

async function drawMultipleEmbeddedTreasure(table, data, rollFormula) {
  let diceRoll = new Roll(rollFormula);
  await diceRoll.evaluate();
  for(let i = 0; i < diceRoll.total; i++) {
    const roll = await table.roll();
    for(const result of roll.results) {
      const text = result.getChatText();
      data.treasure[result.id] = {
        img: result.img,
        text: await TextEditor.enrichHTML(text),
      };
    }
  }
}

async function rollTreasure(table, options = {}) {
  // Draw treasure
  const data = await drawTreasure(table, {});
  let templateData = {
    treasure: data.treasure,
    table: table,
  };

  // Animation
  if (options.event) {
    let results = $(options.event.currentTarget.parentElement)
      .prev()
      .find(".table-result");
    results.each((_, item) => {
      item.classList.remove("active");
      if (data.treasure[item.dataset.resultId]) {
        item.classList.add("active");
      }
    });
  }

  let html = await renderTemplate(
    "systems/acks/templates/chat/roll-treasure.html",
    templateData,
  );

  let chatData = {
    content: html,
    // sound: "/systems/acks/assets/coins.mp3"
  }

  let rollMode = game.settings.get("core", "rollMode");
  if (["gmroll", "blindroll"].includes(rollMode)) chatData["whisper"] = ChatMessage.getWhisperRecipients("GM");
  if (rollMode === "selfroll") chatData["whisper"] = [game.user.id];
  if (rollMode === "blindroll") chatData["blind"] = true;

  ChatMessage.create(chatData);
}
