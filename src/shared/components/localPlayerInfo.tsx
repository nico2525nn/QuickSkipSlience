/**
 * Inform user that Quick Skip Silence doesn't work on local files
 */
import React from 'react';
import './localPlayerInfo.scss';

const LocalPlayerInfo = () => (
  <div className="local-player-info">
    You are trying to use "Quick Skip Silence" with a local video or audio file.<br />
    Due to browser-restrictions, this extension cannot work on local files directly 😔.<br />
    <br />
    Instead, please open the "Quick Skip Silence" Local Video player using the button below, choose your local file in there and use "Quick Skip Silence" normally 🎉.<br />
    <a href="https://vantezzen.github.io/skip-silence/player/index.html" className="player-btn" target="_blank">
      Open Player
    </a>
  </div>
);
export default LocalPlayerInfo;