/*
 * quiz.js — the end-of-module check.
 *
 * Answer once per question; the choice is marked right or wrong immediately
 * and the explanation appears whether the answer was right or not, because
 * the explanation is the teaching, not the reward.
 */

import { h } from './figure.js';

/**
 * questions: [{ stem, options: [string], answer: index, explain }]
 * Renders into `mount` and keeps a running score.
 */
export function quiz(mount, questions) {
  let answered = 0;
  let correct = 0;

  const score = h('p', { class: 'v-quiz-score' });
  const updateScore = () => {
    if (!answered) { score.textContent = ''; return; }
    score.innerHTML = `<strong>${correct} / ${answered}</strong><br>` +
      (answered < questions.length
        ? 'Keep going.'
        : correct === questions.length
          ? 'All correct.'
          : 'Have another look at the ones you missed &mdash; the explanations are above.');
  };

  questions.forEach((q, qi) => {
    const explain = h('div', { class: 'v-explain', hidden: true, html: q.explain });
    const buttons = [];

    const options = h('div', { class: 'v-options' },
      q.options.map((text, oi) => {
        const mark = h('span', { class: 'v-option-mark', 'aria-hidden': 'true' }, String.fromCharCode(65 + oi));
        const btn = h('button', {
          type: 'button',
          class: 'v-option',
          onclick: () => choose(oi),
        }, mark, h('span', {}, text));
        buttons.push(btn);
        return btn;
      })
    );

    function choose(oi) {
      const right = oi === q.answer;
      answered += 1;
      if (right) correct += 1;
      buttons.forEach((b, i) => {
        b.disabled = true;
        if (i === q.answer) {
          b.classList.add('is-right');
          b.querySelector('.v-option-mark').textContent = '✓';
        } else if (i === oi) {
          b.classList.add('is-wrong');
          b.querySelector('.v-option-mark').textContent = '✕';
        }
      });
      explain.hidden = false;
      updateScore();
    }

    mount.appendChild(h('div', { class: 'v-q' },
      h('p', { class: 'v-q-stem' },
        h('span', { class: 'v-q-num' }, `Q${qi + 1}`),
        q.stem
      ),
      options,
      explain
    ));
  });

  mount.appendChild(score);
}
