let userList = [];

(function() {
  function loadUsers() {
    const raw = localStorage.getItem("userList");
    userList = raw ? JSON.parse(raw) : [];
  }
  function saveUsers() {
    localStorage.setItem("userList", JSON.stringify(userList));
  }

  $(function() {
    loadUsers();
    showProfileScreen();

    // CREATE NEW PROFILE
    $(document).on("click", "#newProfileBtn", () => {
      $("body").prepend(`
        <div id="overlayForm">
          <form id="profileForm">
            <h3>New Profile</h3>
            <input type="text" id="profileNameInput" placeholder="Name..." />
            <button type="submit">Add</button>
          </form>
        </div>
      `);
      $("#profileNameInput").focus();
    });

    // SUBMIT NEW PROFILE
    $(document).on("submit", "#profileForm", e => {
      e.preventDefault();
      const nm = $("#profileNameInput").val();
      if (!nm) return;
      userList.push({ name: nm, day: 2, dollar: 1000.0, coins: [] });
      $("#overlayForm").remove();
      saveUsers();
      showProfileScreen();
    });

    // DELETE PROFILE
    $(document).on("click", ".btnDelProfile", function(e) {
      e.stopPropagation();
      const nameVal = $(this).siblings("p").text();
      userList = userList.filter(u => u.name !== nameVal);
      saveUsers();
      showProfileScreen();
    });

    // CLICK PROFILE
    $(document).on("click", ".profileCard", function() {
      const nameVal = $(this).find("p").text();
      $("#outerWrap").attr("data-current-user", nameVal);
      showTradingScreen(nameVal);
    });

    // LOGOUT
    $(document).on("click", "#logoutBtn", () => {
      saveUsers();
      showProfileScreen();
    });

    // NEXT DAY
    $(document).on("click", "#nextDayBtn", () => {
      const currentUserName = $("#outerWrap").attr("data-current-user");
      if (!currentUserName) return;
      const usr = userList.find(x => x.name === currentUserName);
      if (usr.day < 365) {
        usr.day++;
        saveUsers();
        refreshDayDisplay(usr);
      }
    });

    // PLAY/PAUSE
    $(document).on("click", "#playPauseBtn", function() {
      const activeTimer = $("#gameTop").attr("data-timer-id");
      if (activeTimer) {
        clearInterval(parseInt(activeTimer));
        $("#gameTop").removeAttr("data-timer-id");
        $(this).html(`<i class="fas fa-play"></i> Play`);
      } else {
        const currentUserName = $("#outerWrap").attr("data-current-user");
        const usr = userList.find(x => x.name === currentUserName);
        const timerVal = setInterval(() => {
          if (usr.day < 365) {
            usr.day++;
            refreshDayDisplay(usr);
          } else {
            clearInterval(timerVal);
            $("#gameTop").removeAttr("data-timer-id");
            $("#playPauseBtn").html(`<i class="fas fa-play"></i> Play`);
          }
        }, 150);
        $("#gameTop").attr("data-timer-id", timerVal);
        $(this).html(`<i class="fas fa-pause"></i> Pause`);
      }
    });

    // SELECT COIN
    $(document).on("click", "#coinMenu img", function() {
      const coinCode = $(this).attr("id");
      $("#marketBox").attr("data-coin", coinCode);

      $("#coinMenu img").removeClass("heartbeat");

      const nameVal = $("#outerWrap").attr("data-current-user");
      const usr = userList.find(u => u.name === nameVal);
      if (!usr) return;

      refreshDayDisplay(usr);

      $(this).addClass("heartbeat");
    });

    // SWITCH BUY/SELL
    $(document).on("click", "#buyBtn", () => {
      $("#sellBtn").attr("style","background-color:white!important;color:black!important;")
      $("#buyBtn").attr("style","background-color:green!important;color:white!important;")
      
      $("#tradeBox").removeClass("sellMode").addClass("buyMode");
      updateTradeButton();
    });
    $(document).on("click", "#sellBtn", () => {
      $("#buyBtn").attr("style","background-color:white!important;color:black!important;")
      $("#sellBtn").attr("style","background-color:red!important;color:white!important;")

      $("#tradeBox").removeClass("buyMode").addClass("sellMode");
      updateTradeButton();
    });

    // UPDATE TRADE COST
    $(document).on("input", "#tradeQty", function() {
      const amtVal = parseFloat($(this).val()) || 0;
      const coinCode = $("#marketBox").attr("data-coin");
      const currentUserName = $("#outerWrap").attr("data-current-user");
      const usr = userList.find(x => x.name === currentUserName);
      if (!usr) return;

      const dataArr = sliceCoinData(coinCode, usr.day);
      if (!dataArr.length) {
        $("#tradeInfo").text("= $");
        return;
      }
      const lastClose = dataArr[dataArr.length - 1].close;
      const totalCost = amtVal * lastClose;
      $("#tradeInfo").text(`= $${totalCost.toFixed(2)}`);
    });

    // EXECUTE TRADE
    $(document).on("click", "#tradeExec", () => {
      const currentUserName = $("#outerWrap").attr("data-current-user");
      const usr = userList.find(x => x.name === currentUserName);
      if (!usr) return;

      const amountVal = parseFloat($("#tradeQty").val()) || 0;
      const coinCode = $("#marketBox").attr("data-coin");
      const dataArr = sliceCoinData(coinCode, usr.day);
      if (!dataArr.length) return;
      const lastClose = dataArr[dataArr.length - 1].close;

      const coinObj = coins.find(c => c.code === coinCode);
      if (!coinObj) return;

      let existingCoin = usr.coins.find(cc => cc.coin.code === coinObj.code);
      const totalCost = amountVal * lastClose;

      const isBuyMode = $("#tradeBox").hasClass("buyMode");
      if (isBuyMode) {
        if (totalCost <= usr.dollar) {
          usr.dollar -= totalCost;
          if (existingCoin) {
            existingCoin.amount += amountVal;
          } else {
            usr.coins.push({ coin: coinObj, amount: amountVal });
          }
        }
      } else {
        if (existingCoin && amountVal <= existingCoin.amount) {
          existingCoin.amount -= amountVal;
          usr.dollar += totalCost;
        }
      }
      $("#tradeQty").val("");
      $("#tradeInfo").text("= $");
      saveUsers();
      refreshDayDisplay(usr);
    });

    // HOVER ON CHART BARS
    $(document).on("mouseenter", ".bar", function() {
      const idx = parseInt($(this).attr("data-index"));
      const coinCode = $("#marketBox").attr("data-coin");
      const usrName = $("#outerWrap").attr("data-current-user");
      const usr = userList.find(u => u.name === usrName);
      const arr = sliceCoinData(coinCode, usr.day);
      if (!arr[idx]) return;
      const d = arr[idx];
      $("#selectedCurrency p").text(
        `Date: ${d.date}, O: $${d.open}, C: $${d.close}, H: $${d.high}, L: $${d.low}`
      );
    });
    $(document).on("mouseleave", ".bar", () => {
      $("#selectedCurrency p").text("");
    });
  });

  // PROFILE SCREEN
  function showProfileScreen() {
    $("body").html(`
      <div id="outerWrap" data-current-user="">
        <div id="titleBar">
          <h1><b>CTIS</b> - Crypto Trading Information System</h1>
        </div>
      </div>
    `);

    $("#profilePanel").remove();
    $("#gamePanel").remove();

    $("#outerWrap").append(`<div id="profilePanel"></div>`);
    if (!userList.length) {
      $("#profilePanel").html(`<p id="emptyList">Empty</p>`);
    } else {
      userList.forEach(u => {
        $("#profilePanel").append(`
          <div class="profileCard">
            <button class="btnDelProfile"><i class="fas fa-times"></i></button>
            <i class="fas fa-user profIcon"></i>
            <p>${u.name}</p>
          </div>
        `);
      });
    }
    $("#profilePanel").append(`
      <div id="newProfileBtn">
        <button><i class="fas fa-plus"></i> New Profile</button>
      </div>
    `);
  }

  function showTradingScreen(nameVal) {
    const usr = userList.find(u => u.name === nameVal);
    $("#profilePanel").remove();

    $("#outerWrap").append(`
      <div id="gamePanel"></div>
    `);

    $("#titleBar").append(`
      <div id="logoutPanel">
        <p><i class="fas fa-user"></i> ${usr.name}</p>
        <button id="logoutBtn"><i class="fas fa-door-open"></i> Logout</button>
      </div>
    `);

    $("#gamePanel").append(`
      <div id="gameTop">
        <h2>Day ${usr.day}</h2>
        <p>${getDateStr(usr.day)}</p>
        <button id="nextDayBtn"><i class="fas fa-forward"></i> Next</button>
        <button id="playPauseBtn"><i class="fas fa-play"></i> Play</button>
      </div>
      <div id="marketBox" data-coin="btc"></div>
    `);

    $("#marketBox").append(`
      <div id="coinMenu">
        <img src="images/ada.png" id="ada"/>
        <img src="images/avax.png" id="avax"/>
        <img src="images/btc.png" class="heartbeat" id="btc"/>
        <img src="images/doge.png" id="doge"/>
        <img src="images/eth.png" id="eth"/>
        <img src="images/pol.png" id="pol"/>
        <img src="images/snx.png" id="snx"/>
        <img src="images/trx.png" id="trx"/>
        <img src="images/xrp.png" id="xrp"/>
      </div>
      <div id="selectedCurrency">
        <img src="images/btc.png" />
        <h4>BTC</h4>
        <p></p>
      </div>
      <div id="chart"></div>
    `);

    $("#gamePanel").append(`
      <h1 id="totalBalance">$<span></span></h1>
      <div id="tradeSection"></div>
    `);

    $("#tradeSection").append(`
      <div id="tradeBox" class="buyMode">
        <h4>Trading</h4>
        <div>
          <button id="buyBtn" class="selected-button">Buy</button>
          <button id="sellBtn">Sell</button>
        </div>
        <input type="text" id="tradeQty" placeholder="Amount"/><span id="tradeInfo">= $</span>
        <button id="tradeExec">Buy BTC</button>
      </div>
      <div id="walletBox">
        <h4>Wallet</h4>
        <table id="walletTable">
          <tr id="walletHeader">
            <th>Coin</th>
            <th>Amount</th>
            <th>Subtotal</th>
            <th>LastClose</th>
          </tr>
          <tr id="walletDollar">
            <td>Dollar</td>
            <td><b>$${usr.dollar.toFixed(2)}</b></td>
            <td></td>
            <td></td>
          </tr>
        </table>
      </div>
    `);

    refreshDayDisplay(usr);
  }

  function refreshDayDisplay(usr) {
    $("#gameTop h2").text(`Day ${usr.day}`);
    $("#gameTop p").text(getDateStr(usr.day));

    const coinCode = $("#marketBox").attr("data-coin");
    const coinObj = coins.find(c => c.code === coinCode) || coins[0];
    $("#selectedCurrency img").attr("src", `images/${coinObj.image}`);
    $("#selectedCurrency h4").text(coinObj.name);

    drawChart(coinCode, usr.day);
    renderWallet(usr, coinObj);
  }

  function getDateStr(dayNum) {
    if (dayNum < 1 || dayNum > market.length) return "Invalid day";
    return market[dayNum - 1].date;
  }

  function drawChart(cCode, dayNum) {
    $("#chart").html("");
    const cData = sliceCoinData(cCode, dayNum);
    if (!cData.length) return;

    const chartHeight = 200;
    const globalMin = Math.min(...cData.map(d => d.low));
    const globalMax = Math.max(...cData.map(d => d.high));
    const range = globalMax - globalMin || 1;
    const scaleFactor = chartHeight / range;

    const latestClose = cData[cData.length - 1].close;
    const scaledClosePos = (latestClose - globalMin) * scaleFactor + 10;

    $("#chart").append(`
      <div class="dotted-line" style="top:${chartHeight - scaledClosePos + 19}px;"></div>
      <div class="label close" style="top:${chartHeight - scaledClosePos + 4}px;">
          $${latestClose.toFixed(2)}
      </div>
    `);

    let x = -0.7;
    cData.forEach((dayObj, idx) => {
      const stickHeight = (dayObj.high - dayObj.low) * scaleFactor;
      const barHeight = Math.abs(dayObj.open - dayObj.close) * scaleFactor;
      const barPos = (Math.min(dayObj.open, dayObj.close) - globalMin) * scaleFactor + 10;
      const stickBottom = (dayObj.low - globalMin) * scaleFactor + 10;
      const color = dayObj.open < dayObj.close ? "green" : "red";

      x += 100 / 120;
      $("#chart").append(`
        <div class='stick' style='height:${stickHeight}px; bottom:${stickBottom}px; left:${x + 0.18}%;'></div>
      `);
      $("#chart").append(`
        <div class='bar' style='background:${color}; bottom:${barPos}px; left:${x - 0.1}%; 
            height:${barHeight}px; width:${100 / 180}%;' data-index="${idx}">
        </div>
      `);
    });

    $("#chart").append(`<div class="label max">$${globalMax.toFixed(2)}</div>`);
    $("#chart").append(`<div class="label min">$${globalMin.toFixed(2)}</div>`);
  }

  function sliceCoinData(cCode, dayCount) {
    let start = 0;
    if (dayCount > 121) {
      start = dayCount - 121;
    }
    return market.slice(start, dayCount - 1).map(m => {
      const co = m.coins.find(x => x.code === cCode);
      return {
        date: m.date,
        open: co.open,
        high: co.high,
        low: co.low,
        close: co.close
      };
    });
  }

  function renderWallet(usr, coinObj) {
    $("#walletTable tr:not(#walletHeader,#walletDollar)").remove();
    const dayData = market[usr.day - 2];
    let totalVal = usr.dollar;

    if (dayData) {
      usr.coins.forEach(cc => {
        const cPriceInfo = dayData.coins.find(c => c.code === cc.coin.code);
        if (cPriceInfo) {
          const worth = cc.amount * cPriceInfo.close;
          totalVal += worth;
          $("#walletTable").append(`
            <tr>
              <td><img src="images/${cc.coin.image}"/><span> ${cc.coin.name}</span></td>
              <td>${cc.amount.toFixed(4)}</td>
              <td>${worth.toFixed(2)}</td>
              <td>${cPriceInfo.close.toFixed(2)}</td>
            </tr>
          `);
        }
      });
    }
    $("#walletDollar td:nth-child(2) b").text(`$${usr.dollar.toFixed(2)}`);
    $("#totalBalance span").text(totalVal.toFixed(2));
    updateTradeButton();
  }

  function updateTradeButton() {
    const coinCode = $("#marketBox").attr("data-coin");
    const coinObj = coins.find(c => c.code === coinCode) || { name: "???" };
    const isBuy = $("#tradeBox").hasClass("buyMode");
    $("#tradeExec").text(`${isBuy ? "Buy" : "Sell"} ${coinObj.name.toUpperCase()}`);
  }
})();
