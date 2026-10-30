/* ============================================================
 * 《一分钟训练沙漏》 —— 主交互逻辑
 *
 * 设计要点：
 * 1. 整个流程状态机：product → success → input → training → result → flip → ...
 * 4. 沙漏动画用 SVG + setInterval 控制沙子高度
 * 5. 翻转动画：通过 CSS .flip class 实现 180° 旋转
 * 6. 每次翻转后计数器 cycleCount 累加，提示越来越抽象
 * 7. 达到隐藏结局阈值后，沙漏仍在跑，UI 极简化
 * ============================================================ */

(function () {
  const C = window.APP_CONFIG;
  /* ---------- 工具函数 ---------- */
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  /* ---------- 1. 商品页静态内容渲染 ---------- */
  function renderProduct() {
    $('#prodName').textContent = C.product.name;
    const sub = $('#prodSubtitle');
    C.product.subtitle.forEach(t => {
      const p = document.createElement('p'); p.textContent = t; sub.appendChild(p);
    });

    $('#prodRating').textContent = C.product.rating;
    $('#prodSold').textContent = C.product.sold;
    $('#prodFav').textContent = C.product.favorite;
    $('#priceNow').textContent = C.product.priceNow;
    $('#priceOld').textContent = '原价 ' + C.product.priceOld;

    const promo = $('#pricePromo');
    C.product.promo.forEach(t => {
      const s = document.createElement('span'); s.textContent = t; promo.appendChild(s);
    });

    const tags = $('#tagRow');
    C.product.tags.forEach(t => {
      const s = document.createElement('span'); s.className = 'tag'; s.textContent = t; tags.appendChild(s);
    });

    $('#shipStock').innerHTML = '📦 库存：<b style="color:var(--c-red)">' + C.product.stock + '</b>';
    $('#shipFree').innerHTML = '🚚 ' + C.product.shipping;
    $('#shipReturn').innerHTML = '🛡 ' + C.product.returnPolicy;

    // 卖点
    const feat = $('#features');
    C.features.forEach((f, idx) => {
      const card = document.createElement('div');
      card.className = 'feature';
      const h = document.createElement('h3'); h.textContent = (idx + 1) + '、' + f.title; card.appendChild(h);
      f.lines.forEach(l => {
        const p = document.createElement('p'); p.textContent = l; card.appendChild(p);
      });
      if (idx === 1) {
        const ar = document.createElement('div'); ar.className = 'arrow'; ar.innerHTML = '训练者 ➜ 被训练者<br>被训练者 ➜ 训练者'; card.appendChild(ar);
      }
      feat.appendChild(card);
    });

    // 评价
    const list = $('#reviewList');
    C.reviews.forEach(r => {
      const card = document.createElement('div');
      card.className = 'review-card';
      card.innerHTML = `
        <div class="review-stars">${'★'.repeat(r.stars)}</div>
        <div class="review-text">${r.text}</div>
        <div class="review-user">
          <span class="avatar">👤</span>
          <span>${r.user}</span>
        </div>
      `;
      list.appendChild(card);
    });

    // 提示词 chips
    const chipRow = $('#chipRow');
    C.inputSuggestions.forEach(s => {
      const c = document.createElement('span');
      c.className = 'chip'; c.textContent = s;
      c.addEventListener('click', () => { $('#trainInput').value = s; });
      chipRow.appendChild(c);
    });

    // 顶部搜索框 placeholder
    $('#searchInput').placeholder = C.searchPlaceholder;
  }

  /* ---------- 2. 状态变量 ---------- */
  const state = {
    phase: 'product',     // product | success | input | training | result | minimal
    cycleCount: 0,        // 已翻转次数
    saidText: '',         // 用户输入的训练话
    trainer: '您',         // 当前谁是训练者
    trainee: '未知',       // 当前谁是被训练者
    trainInterval: null,
    timeLeft: 60,
  };

  /* ---------- 3. 弹层与训练屏切换 ---------- */
  function showSuccess() {
    state.phase = 'success';
    $('#successOverlay').classList.add('show');
  }
  function closeSuccess() {
    $('#successOverlay').classList.remove('show');
  }
  function enterTraining() {
    closeSuccess();
    state.phase = 'input';
    state.cycleCount = 0;
    state.trainer = '您';
    state.trainee = '未知';
    state.timeLeft = 60;
    $('#trainingScreen').classList.add('show');
    $('#trainingScreen').classList.remove('minimal');
    $('#inputPanel').style.display = '';
    $('#trainProgressWrap').style.display = 'none';
    $('#trainInput').value = '';
    $('#trainInput').disabled = false;
    $('#btnBeginTrain').disabled = false;
    $('#btnFlip').style.display = 'none';
    $('#btnReset').style.display = 'none';
    $('#resultCard').style.display = 'none';
    $('#progressFill').style.width = '0%';
    $('#progressText').textContent = '0%';
    $('#hintLine').textContent = '请输入您想让对方学会的话';
    $('#timer').textContent = '01:00';
    // 还原沙漏（包括移除 .flip/.flipped 残留，确保新会话从 0deg 开始）
    $('#hourglass').classList.remove('flip', 'flipped');
    resetSandSvg();
    updateRoles();
  }

  function exitTraining() {
    if (state.trainInterval) clearInterval(state.trainInterval);
    $('#trainingScreen').classList.remove('show');
    state.phase = 'product';
  }

  /* ---------- 4. 训练流程 ---------- */
  function beginTraining() {
    const txt = ($('#trainInput').value || '').trim();
    if (!txt) {
      $('#hintLine').textContent = '请输入一句话再开始训练';
      return;
    }
    state.saidText = txt;
    state.timeLeft = 60;
    state.phase = 'training';

    $('#trainInput').disabled = true;
    $('#btnBeginTrain').disabled = true;
    $('#inputPanel').style.display = 'none';
    $('#trainProgressWrap').style.display = 'flex';

    // 第一次：标签
    $('#hintLine').textContent = '正在训练……';
    runCountdown();
  }

  function runCountdown() {
    if (state.trainInterval) clearInterval(state.trainInterval);
    updateTimer();
    animateSandSvg(state.timeLeft, 60);

    state.trainInterval = setInterval(() => {
      state.timeLeft -= 1;
      if (state.timeLeft <= 0) {
        clearInterval(state.trainInterval);
        state.trainInterval = null;
        state.timeLeft = 0;
        finishTraining();
      }
      updateTimer();
      animateSandSvg(state.timeLeft, 60);
    }, 1000);
  }

  function updateTimer() {
    const m = String(Math.floor(state.timeLeft / 60)).padStart(2, '0');
    const s = String(state.timeLeft % 60).padStart(2, '0');
    $('#timer').textContent = `${m}:${s}`;
    const percent = Math.round(((60 - state.timeLeft) / 60) * 100);
    $('#progressFill').style.width = percent + '%';
    $('#progressText').textContent = percent + '%';
  }

  function finishTraining() {
    state.phase = 'result';
    $('#progressFill').style.width = '100%';
    $('#progressText').textContent = '100%';

    // 第一次训练完成后：恭喜您
    if (state.cycleCount === 0) {
      setHint('训练完成！');
      setTimeout(() => {
        setHint('恭喜您，训练成功。');
        setTimeout(() => showResultCard(), 600);
      }, 1000);
    } else {
      // 后续轮次：学习完成
      const learningHints = ['学习完成。', '正在接受训练……', '正在学习……', '记忆写入中……'];
      setHint(learningHints[state.cycleCount % learningHints.length]);
      setTimeout(() => showResultCard(), 800);
    }
  }

  function setHint(t) { $('#hintLine').textContent = t; }

  function showResultCard() {
    $('#resTrainer').textContent = state.trainer;
    $('#resTrainee').textContent = state.trainee;
    if (state.cycleCount === 0) {
      $('#resSaid').innerHTML = '训练内容：<b>' + escapeHtml(state.saidText) + '</b>';
    } else {
      $('#resSaid').innerHTML = '本次学习内容：<b>' + escapeHtml(state.saidText) + '</b>';
    }
    $('#resultCard').style.display = '';
    $('#btnFlip').style.display = '';
    $('#btnReset').style.display = '';

    if (state.cycleCount === 0) {
      $('#btnFlip').textContent = '翻 转 沙 漏';
    } else {
      $('#btnFlip').textContent = '再次翻转';
    }
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, ch => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[ch]));
  }

  /* ---------- 5. 翻转核心 ----------
 * 物理翻转分 3 阶段：
 *  1. 抬起（0–150ms）   —— 沙漏上移 30px，scale 1.05
 *  2. 空中翻转（150–950ms）—— 同时旋转 180°
 *  3. 落下（950–1100ms）—— scale 回弹 0.98→1
 * 用 CSS keyframes 一次性播完，再切回 .flip 维持 180° 终态
 */
  function flipHourglass() {
    state.cycleCount += 1;

    // 切换身份
    const newTrainer = state.trainee;
    const newTrainee = state.trainer;
    state.trainer = newTrainer;
    state.trainee = newTrainee;

    const hg = $('#hourglass');
    // 完整重置：去掉所有状态类 + 触发回流，确保动画可重播
    hg.classList.remove('flip', 'flipped');
    void hg.offsetWidth;

    // 开始物理翻转动画
    hg.classList.add('flip');
    $('#hintLine').textContent = '正在翻转……';

    // 监听动画结束（animation 走完 1.1s 后触发）
    const onAnimEnd = () => {
      hg.removeEventListener('animationend', onAnimEnd);
      // 动画结束后切到 .flipped 维持 180° 终态
      hg.classList.remove('flip');
      hg.classList.add('flipped');
      afterFlip();
    };
    hg.addEventListener('animationend', onAnimEnd);
    // 兜底：1200ms 后强制结束（防止 animationend 因某些原因不触发）
    setTimeout(() => onAnimEnd(), 1200);
  }

  function afterFlip() {
    // 隐藏结局判定：>= 10 次进入极简态
    if (state.cycleCount >= 10) {
      enterMinimal();
      return;
    }

    // 根据次数给出荒谬提示
    const hints = C.cycleHints;
    const idx = Math.min(state.cycleCount - 1, hints.length - 1);
    const hint = hints[idx] || hints[hints.length - 1];

    setHint(hint);
    setTimeout(() => {
      setHint('身份交换成功。');
      setTimeout(() => {
        setHint('现在轮到您学习了。');
        setTimeout(() => {
          // 进入第二轮：把当前输入换成上一轮说给"被训练者"的，但本轮让"您"学习
          $('#trainProgressWrap').style.display = 'none';
          $('#inputPanel').style.display = '';
          $('#resultCard').style.display = 'none';
          $('#btnFlip').style.display = 'none';
          $('#btnReset').style.display = 'none';
          $('#trainInput').value = state.saidText;
          $('#trainInput').disabled = false;
          $('#btnBeginTrain').disabled = false;
          $('#btnBeginTrain').textContent = '开始学习';
          state.phase = 'input';
        }, 900);
      }, 900);
    }, 700);
  }

  function updateRoles() {
    $('#roleTop').textContent = state.trainer === '您' ? '训练者' : '训练者';
    $('#roleBottom').textContent = state.trainee === '您' ? '被训练者' : '被训练者';
    // 当 cycle >= 1 时，主屏用户是被训练者（学习者），所以切换一下视觉提示
    if (state.cycleCount >= 1) {
      // 此时"您"在被训练位（下方），但 UI 上方是"训练者"
      $('#roleTop').textContent = '训练者';
      $('#roleBottom').textContent = '被训练者';
    }
  }

  /* ---------- 6. 隐藏结局：极简沙漏 ---------- */
  function enterMinimal() {
    state.phase = 'minimal';
    $('#trainingScreen').classList.add('minimal');
    $('#trainProgressWrap').style.display = 'flex';
    $('#inputPanel').style.display = 'none';
    $('#resultCard').style.display = 'none';
    $('#btnFlip').style.display = 'none';
    $('#btnReset').style.display = 'none';

    setHint(C.endScreen.title);
    setTimeout(() => setHint(C.endScreen.sub1), 1200);
    setTimeout(() => {
      setHint(C.endScreen.sub2);
      const btn = document.createElement('button');
      btn.className = 'btn-flip';
      btn.textContent = C.endScreen.button;
      btn.style.marginTop = '20px';
      btn.onclick = () => {
        btn.remove();
        $('#trainingScreen').classList.remove('minimal');
        // 重置 cycleCount，但保留互动
        state.cycleCount = 0;
        state.trainer = '您'; state.trainee = '未知';
        $('#inputPanel').style.display = '';
        $('#btnBeginTrain').textContent = '开始训练';
        $('#hintLine').textContent = '请输入您想让对方学会的话';
        state.phase = 'input';
      };
      $('.train-body').appendChild(btn);
    }, 2400);

    // 极简态：沙漏继续空跑（不停），给人一种"还在训练但没人了"的感觉
    if (state.trainInterval) clearInterval(state.trainInterval);
    state.timeLeft = 60;
    runCountdown();
    // 完成后不再弹出任何卡，让沙子重新下落，循环空跑
    state.trainInterval = setInterval(() => {
      state.timeLeft -= 1;
      if (state.timeLeft <= 0) {
        clearInterval(state.trainInterval);
        state.timeLeft = 60;
        animateSandSvg(60, 60);
        runCountdownLoopOnly();
      }
    }, 1000);
  }
  function runCountdownLoopOnly() {
    if (state.trainInterval) clearInterval(state.trainInterval);
    animateSandSvg(state.timeLeft, 60);
    state.trainInterval = setInterval(() => {
      state.timeLeft -= 1;
      if (state.timeLeft <= 0) {
        clearInterval(state.trainInterval);
        state.timeLeft = 60;
        animateSandSvg(60, 60);
        runCountdownLoopOnly();
      } else {
        animateSandSvg(state.timeLeft, 60);
      }
    }, 1000);
  }

  /* ---------- 7. 沙漏光效强度（图片本身是静态沙漏，通过光效暗示流动） ---------- */
  function animateSandSvg(remaining, total) {
    /* 图片已是完整沙漏，这里只调整中心光效的强度/位移，越接近完成光效越弱 */
    const ratio = 1 - remaining / total;
    const glow = document.getElementById('sandGlow');
    if (!glow) return;
    const opacity = Math.max(0.25, 1 - ratio * 0.7);
    const scale = 1 + 0.15 * Math.sin((1 - ratio) * Math.PI * 4);
    glow.style.opacity = opacity.toFixed(2);
    glow.style.transform = `translate(-50%, -50%) scale(${scale.toFixed(2)})`;
  }
  function resetSandSvg() {
    const glow = document.getElementById('sandGlow');
    if (glow) {
      glow.style.opacity = '1';
      glow.style.transform = 'translate(-50%, -50%) scale(1)';
    }
  }

  /* ---------- 8. 事件绑定 ---------- */
  function bindEvents() {
    $('#btnBuy').addEventListener('click', showSuccess);
    $('#closeSuccess').addEventListener('click', closeSuccess);
    $('#btnStartUse').addEventListener('click', enterTraining);
    $('#backHome').addEventListener('click', () => {
      if (confirm('确定返回商品页吗？训练进度不会保存。')) {
        exitTraining();
      }
    });

    $('#btnBeginTrain').addEventListener('click', () => {
      // 根据 phase 决定是"训练"还是"学习"
      if (state.phase === 'input') {
        const txt = ($('#trainInput').value || '').trim();
        if (!txt) { setHint('请输入一句话再开始'); return; }
        state.saidText = txt;
        $('#trainInput').disabled = true;
        $('#btnBeginTrain').disabled = true;
        $('#inputPanel').style.display = 'none';
        $('#trainProgressWrap').style.display = 'flex';
        $('#progressFill').style.width = '0%';
        $('#progressText').textContent = '0%';
        $('#timer').textContent = '01:00';
        state.timeLeft = 60;

        if (state.cycleCount === 0) {
          setHint('正在训练……');
        } else {
          setHint('正在接受训练……');
        }
        runCountdown();
      }
    });

    $('#btnFlip').addEventListener('click', () => {
      $('#btnFlip').style.display = 'none';
      $('#resultCard').style.display = 'none';
      flipHourglass();
    });

    $('#btnReset').addEventListener('click', enterTraining);

    // 评价滚动：水平滚动，鼠标悬停时减速（CSS 已支持 overflow-x）
  }

  /* ---------- 9. 初始化 ---------- */
  function init() {
    renderProduct();
    bindEvents();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();