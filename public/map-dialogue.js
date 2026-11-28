const mapDialogueLines = {
  start: [
    '作戦開始。まずは足場を固めよう！',
    '地図を開け。ここからが本番だ！',
    '次の一手で流れを作るぞ！',
    '全隊、準備を始めよう！',
    '作戦を始める。まずは地形を見よう。',
  ],
  resume: [
    '通信がつながった。作戦を再開する！',
    'おかえり。前の配置を確認しよう。',
    '記録は残っている。続きからだ！',
    '全隊、持ち場を確認。再開する！',
    '地図はそのままだ。次の一手を頼む！',
  ],
  friendlyTurn: [
    'こちらの手番だ。先に動こう！',
    '今度はこちらから仕掛ける番だ！',
    '全隊、次の指示を待て！',
    '落ち着いて、一部隊ずつ動かそう。',
    'さあ、持ち場から動き出そう！',
  ],
  enemyTurn: [
    '敵の手番だ。動きを見逃すな！',
    '敵に手番が渡った。各隊、警戒！',
    'どの部隊から動くか、よく見ておけ。',
    '持ち場を守れ。相手の出方を見るぞ。',
    '全隊、周囲を見張れ。敵が動く！',
  ],
  selectFoot: [
    'こちら地上班。指示をどうぞ！',
    '足で行ける場所なら任せてくれ！',
    '装備はそろった。いつでも出られる！',
    'こちらの隊はそろっているぞ！',
    '隊列を整えた。行き先を頼む！',
  ],
  selectVehicle: [
    'エンジン始動。どこへ向かう？',
    'こちら車両班。進路を頼む！',
    '車体よし。合図を待っている。',
    '動かせるぞ。目的地を教えてくれ！',
    '操縦席は準備できている！',
  ],
  selectAir: [
    'こちら航空隊。指示が聞こえる！',
    '空から見ている。行き先を頼む！',
    '高度を保つ。次はどこだ？',
    '航路を合わせる。指示をくれ！',
    'こちら上空。いつでも転進できる！',
  ],
  selectSea: [
    'こちら艦橋。進路をどうぞ！',
    '海上より応答。針路を待っている。',
    '舵を取れるぞ。どちらへ向かう？',
    '全員配置についた。次の指示を！',
    'こちら艦隊。通信は良好だ！',
  ],
  move: [
    '了解、その地点へ向かう！',
    '移動を開始する。ついてこい！',
    '先に進むぞ。隊列を崩すな！',
    '指定地点へ移動する！',
    '進路よし。今から向かう！',
  ],
  moveReady: [
    '到着した。ここで指示を待つ！',
    '移動完了。周囲を警戒する！',
    '指定地点についたぞ！',
    '配置についた。次の指示を！',
    '到着を確認。各員、持ち場につけ！',
  ],
  moveCancel: [
    '了解、元の位置へ戻る！',
    '進路変更。出発地点へ引き返す！',
    'いったん戻って態勢を立て直す。',
    '引き返すぞ。落ち着いて進め！',
    '別の手を考えよう。元の位置に戻る。',
  ],
  deploy: [
    '新隊、配置につきました！',
    'ここからは自分たちも力になる！',
    '増援が到着！　次の指示を待つ。',
    '出撃準備よし。作戦に加わる！',
    '新しい部隊だ。よろしく頼む！',
  ],
  enemyDeploy: [
    '新部隊、こちらの戦列に加われ！',
    '増援が着いた。持ち場につけ！',
    '出撃した隊は次の命令を待て。',
    'もう一隊出たぞ。指示を伝えろ！',
    '新隊の出撃を確認。隊列を組め！',
  ],
  capture: [
    '確保の途中だ。もう少し踏ん張れ！',
    'ここはまだ占領完了じゃない！',
    '占領を進めている。持ち場を守れ！',
    'この場所を押さえるまで警戒を続けろ。',
    'もうひと押しだ。足元を固めよう！',
  ],
  secured: [
    '確保できた！　ここの守りは任せろ。',
    '占領完了。司令部、聞こえるか！',
    'この施設は押さえたぞ！',
    '確保成功。後続に連絡してくれ！',
    '占領した。各員、周囲を確認！',
  ],
  enemyCapture: [
    '敵に施設を押さえられた！',
    '占領された。地図で位置を確認しろ！',
    'あの施設に敵が入った。次の手を考えよう。',
    '敵が確保したぞ。周囲の部隊は警戒！',
    '敵の占領を確認！　ここから立て直す。',
  ],
  heal: [
    '補給が届いた。まだ動けるぞ！',
    '手当てが済んだ。戦線へ戻れる！',
    '回復を確認。助かったよ！',
    '補給ありがとう。これで持ち直せる。',
    '整備完了。態勢を立て直した！',
  ],
  enemyAdvance: [
    '次の地点まで前進。遅れるな！',
    '指定位置へ移動する。隊列を保て！',
    '持ち場を変える。こちらに続け！',
    '先へ進むぞ。周囲に目を配れ！',
    '進路を合わせろ。前進する！',
  ],
  spotEnemy: [
    '敵影を確認。届く範囲を見ておこう。',
    '相手が見えたぞ。位置を伝える！',
    '目標を確認。まずは動きを読もう。',
    '敵がいる。こちらとの距離を見ろ！',
    '敵の位置を確認した。近くの隊は注意。',
  ],
  battleReturn: [
    '交戦終了。各隊の状況を確認しろ。',
    '戦闘の報告が入った。次の指示を頼む！',
    '各隊、位置と残りの戦力を確認！',
    'いったん全体を見よう。次はどこだ？',
    '交戦を終えた。地図を見直そう！',
  ],
};

function createMapDialogue(bubble, viewport) {
  const label = bubble.querySelector('.map-speech-name');
  const quote = bubble.querySelector('.map-speech-quote');
  const used = new Map();
  let timeout;

  function clear() {
    clearTimeout(timeout);
    bubble.hidden = true;
  }

  return {
    clear,
    show(event, speaker, side, anchor, ambient) {
      const lines = mapDialogueLines[event];
      if (!lines || (ambient && !bubble.hidden && bubble.dataset.event !== 'enemyTurn')) return;
      const index = used.get(event) ?? 0;
      used.set(event, (index + 1) % lines.length);
      const frame = viewport.getBoundingClientRect();
      const box = anchor?.getBoundingClientRect();
      const x = box && (box.left + box.right) / 2;
      const visible = box && x >= frame.left && x <= frame.right && box.bottom > frame.top && box.top < frame.bottom;
      bubble.dataset.align = (visible ? x < (frame.left + frame.right) / 2 : side === 'enemy') ? 'right' : 'left';
      bubble.dataset.side = side;
      bubble.dataset.event = event;
      label.textContent = speaker;
      quote.textContent = lines[index];
      clearTimeout(timeout);
      bubble.hidden = false;
      timeout = setTimeout(clear, 2100);
    },
  };
}
