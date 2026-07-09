const GAS_API_URL =
  "https://script.google.com/macros/s/AKfycbzXe0a2PrSplqPlgWx6BfqN3bZrNZVhVYyvjksehAsHr7glW6p93SKKv3TQKJPFBGqp/exec";

let shiftData = [];
let selectedIndex = -1;
let editMode = "new";

let masterData = {
  staff: [],
  choices: {}
};

function qs(selector) {
  return document.querySelector(selector);
}

function qsa(selector) {
  return Array.from(document.querySelectorAll(selector));
}

function setInput(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value || "";
}

function getInput(id) {
  const el = document.getElementById(id);
  return el ? el.value : "";
}

function renderList() {
  const list = qs(".shift-list");
  const filterUser = getInput("filterUser");
  const filterWeekday = getInput("filterWeekday");

  list.innerHTML = "";

  shiftData.forEach((item, index) => {
    if (filterUser && item.user !== filterUser) return;
    if (filterWeekday && item.weekday !== filterWeekday) return;

    const div = document.createElement("div");
    div.className =
      "shift-item" + (index === selectedIndex ? " selected" : "");

    div.innerHTML = `
      <div class="shift-line1">
        <span>${item.weekday || ""}曜日</span>
        <span>${item.startTime || ""}～${item.endTime || ""}</span>
        <span class="shift-name">${item.user || ""}</span>
      </div>
      <div class="shift-line2">
        <span>${item.service || ""}</span>
        <span>${item.people || ""}</span>
      </div>
    `;

    div.addEventListener("click", () => {
      selectedIndex = index;
      editMode = "update";
      loadToForm(item);
      renderList();
    });

    list.appendChild(div);
  });
}

function updateFilterOptions() {
  const filterUser = qs("#filterUser");
  const currentValue = filterUser.value;

  const users = [...new Set(
    shiftData
      .map(item => item.user)
      .filter(name => name)
  )].sort();

  filterUser.innerHTML = `<option value="">すべての利用者</option>`;

  users.forEach(user => {
    const option = document.createElement("option");
    option.value = user;
    option.textContent = user;
    filterUser.appendChild(option);
  });

  filterUser.value = currentValue;
}

function updateUserSelectOptions() {
  const userSelect = qs("#userSelect");
  const currentValue = userSelect.value;

  const users = [...new Set(
    shiftData
      .map(item => item.user)
      .filter(name => name)
  )].sort();

  userSelect.innerHTML = `<option value="">選択してください</option>`;

  users.forEach(user => {
    const option = document.createElement("option");
    option.value = user;
    option.textContent = user;
    userSelect.appendChild(option);
  });

  userSelect.value = currentValue;
}

function loadToForm(item) {
  setInput("masterId", item.id);
  setInput("historyId", item.historyId);
  setInput("userSelect", item.user);
  setInput("startDate", formatDateForInput(item.startDate));
  setInput("endDate", formatDateForInput(item.endDate));
  setInput("weekdaySelect", item.weekday);
  setInput("startTime", formatTimeForInput(item.startTime));
  setInput("endTime", formatTimeForInput(item.endTime));
  setInput("peopleSelect", item.people || "1人");
  setInput("serviceSelect", item.service);
  setInput("weekPatternText", item.weekPattern || "");
  setInput("changeType", item.changeType || "通常");
  setInput("staff1", item.staff1);
  setInput("staff2", item.staff2);
  setInput("staff3", item.staff3);
  setInput("staff4", item.staff4);
  setInput("support", item.support);
  setInput("destination", item.destination);
  setInput("meeting", item.meeting);
  setInput("transport", item.transport);
  setInput("note", item.note);

  qsa("#weekPanel input").forEach(cb => {
    cb.checked = false;

    if ((item.weekPattern || "") === "" && cb.value === "毎") {
      cb.checked = true;
    }

    if (item.weekPattern && item.weekPattern.includes(cb.value)) {
      cb.checked = true;
    }
  });

	document.getElementById("userSelect").disabled = editMode === "update";

}

function formToData() {
  return {
    id: getInput("masterId") || createNewId(),
    historyId: getInput("historyId") || createNewHistoryId(),
    startDate: getInput("startDate"),
    endDate: getInput("endDate"),
    weekPattern: getInput("weekPatternText"),
    weekday: getInput("weekdaySelect"),
    order: "",
    user: getInput("userSelect"),
    service: getInput("serviceSelect"),
    startTime: getInput("startTime"),
    endTime: getInput("endTime"),
    people: getInput("peopleSelect"),
    changeType: getInput("changeType"),
    staff1: getInput("staff1"),
    staff2: getInput("staff2"),
    staff3: getInput("staff3"),
    staff4: getInput("staff4"),
    support: getInput("support"),
    destination: getInput("destination"),
    meeting: getInput("meeting"),
    meetingPoint: "",
    transport: getInput("transport"),
    detailNote: "",
    simpleMemo: "",
    note: getInput("note")
  };
}

function clearForm() {
  setInput("masterId", createNewId());
  setInput("historyId", createNewHistoryId());
  setInput("userSelect", "");
  setInput("startDate", "");
  setInput("endDate", "");
  setInput("weekdaySelect", "");
  setInput("startTime", "");
  setInput("endTime", "");
  setInput("peopleSelect", "1人");
  setInput("serviceSelect", "");
  setInput("weekPatternText", "");
  setInput("changeType", "通常");
  setInput("staff1", "");
  setInput("staff2", "");
  setInput("staff3", "");
  setInput("staff4", "");
  setInput("support", "");
  setInput("destination", "");
  setInput("meeting", "");
  setInput("transport", "");
  setInput("note", "");

  qsa("#weekPanel input").forEach(cb => cb.checked = false);

	document.getElementById("userSelect").disabled = false;
}

function validateData(data) {
  if (!data.user) return "利用者を選択してください";
  if (!data.weekday) return "曜日を選択してください";
  if (!data.startTime) return "開始時刻を入力してください";
  if (!data.endTime) return "終了時刻を入力してください";
  if (!data.service) return "サービスを選択してください";
  return "";
}

function createNewId() {
  return "SK" + String(shiftData.length + 1).padStart(6, "0");
}

function createNewHistoryId() {
  return "SKH" + String(Date.now()).slice(-10);
}

function saveCurrent() {
  const data = formToData();

  const errorMessage = validateData(data);
  if (errorMessage) {
    alert(errorMessage);
    return;
  }

  if (editMode === "new") {
    shiftData.push(data);
    selectedIndex = shiftData.length - 1;
    editMode = "update";
  } else if (selectedIndex >= 0) {
    shiftData[selectedIndex] = data;
  }

  updateFilterOptions();
  updateUserSelectOptions();
  renderList();

  alert("保存しました");
}

function cancelEdit() {
  if (editMode === "new") {
    selectedIndex = -1;
    clearForm();
    renderList();
    return;
  }

  if (selectedIndex >= 0) {
    loadToForm(shiftData[selectedIndex]);
  }
}

function copyToNew() {
  if (selectedIndex < 0) {
    alert("コピー元を一覧から選択してください");
    return;
  }

  const source = shiftData[selectedIndex];

  const copied = {
    ...source,
    id: createNewId(),
    historyId: createNewHistoryId()
  };

  editMode = "new";
  selectedIndex = -1;

  loadToForm(copied);
  renderList();
}

function toggleWeekPanel() {
  const panel = document.getElementById("weekPanel");
  panel.classList.toggle("hidden");
}

function updateWeekPattern() {
  const checks = qsa("#weekPanel input:checked").map(cb => cb.value);

  let text = "";

  if (checks.includes("毎")) {
    text = "";
  } else {
    text = checks.join("");
  }

  setInput("weekPatternText", text);
}

function loadShiftDataFromGas() {
  return new Promise((resolve) => {
    const callbackName = "shiftKCallback_" + Date.now();
    const script = document.createElement("script");

    window[callbackName] = function(result) {
      if (!result.success) {
        alert(result.message || "データの読み込みに失敗しました");
        shiftData = [];
      } else {
        shiftData = result.data || [];
      }

      delete window[callbackName];

      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }

      resolve();
    };

    script.src =
      GAS_API_URL +
      "?action=list&callback=" +
      encodeURIComponent(callbackName);

    script.onerror = function() {
      alert("GASからデータを読み込めませんでした。空の一覧で開始します。");
      shiftData = [];
      delete window[callbackName];

      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }

      resolve();
    };

    document.body.appendChild(script);
  });
}

function formatDateForInput(value) {
  if (!value) return "";

  if (typeof value === "string") {
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;

    if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(value)) {
      const parts = value.split("/");
      return [
        parts[0],
        parts[1].padStart(2, "0"),
        parts[2].padStart(2, "0")
      ].join("-");
    }
  }

  const date = new Date(value);
  if (isNaN(date.getTime())) return "";

  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function formatTimeForInput(value) {
  if (value === "" || value === null || value === undefined) return "";

  if (typeof value === "number") {
    const text = String(value).padStart(4, "0");
    return text.slice(0, 2) + ":" + text.slice(2, 4);
  }

  if (typeof value === "string") {
    if (/^\d{1,2}:\d{2}$/.test(value)) {
      const parts = value.split(":");
      return parts[0].padStart(2, "0") + ":" + parts[1];
    }

    if (/^\d{1,4}$/.test(value)) {
      const text = value.padStart(4, "0");
      return text.slice(0, 2) + ":" + text.slice(2, 4);
    }
  }

  const date = new Date(value);
  if (isNaN(date.getTime())) return "";

  return (
    String(date.getHours()).padStart(2, "0") +
    ":" +
    String(date.getMinutes()).padStart(2, "0")
  );
}

document.addEventListener("DOMContentLoaded", async () => {
  qs(".new-button").addEventListener("click", () => {
    editMode = "new";
    selectedIndex = -1;
    clearForm();
    renderList();
  });

  qs(".copy-button").addEventListener("click", copyToNew);
  qs(".save-button").addEventListener("click", saveCurrent);
  qs(".secondary-button").addEventListener("click", cancelEdit);

  qs("#weekButton").addEventListener("click", toggleWeekPanel);

  qs("#filterUser").addEventListener("change", renderList);
  qs("#filterWeekday").addEventListener("change", renderList);

	await loadMasterDataFromGas();
	applyMasterOptions();

  await loadShiftDataFromGas();

  updateFilterOptions();
  updateUserSelectOptions();
  renderList();

  if (shiftData.length > 0) {
    selectedIndex = 0;
    editMode = "update";
    loadToForm(shiftData[0]);
    renderList();
  } else {
    selectedIndex = -1;
    editMode = "new";
    clearForm();
  }
});

function setSelectOptions(id, list, firstText = "選択してください") {
  const select = document.getElementById(id);
  if (!select) return;

  const currentValue = select.value;
  select.innerHTML = "";

  const empty = document.createElement("option");
  empty.value = "";
  empty.textContent = firstText;
  select.appendChild(empty);

  list.forEach(value => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = value;
    select.appendChild(option);
  });

  select.value = currentValue;
}

function applyMasterOptions() {
  setSelectOptions("staff1", masterData.staff);
  setSelectOptions("staff2", masterData.staff);
  setSelectOptions("staff3", masterData.staff);
  setSelectOptions("staff4", masterData.staff);

  setSelectOptions("serviceSelect", masterData.choices["サービス"] || []);
  setSelectOptions("transport", masterData.choices["移動手段"] || [], "選択");
}

function loadMasterDataFromGas() {
  return new Promise((resolve) => {
    const callbackName = "masterCallback_" + Date.now();
    const script = document.createElement("script");

    window[callbackName] = function(result) {
      if (result.success) {
        masterData.staff = result.staff || [];
        masterData.choices = result.choices || {};
      } else {
        alert(result.message || "マスタ情報の読み込みに失敗しました");
      }

      delete window[callbackName];
      if (script.parentNode) script.parentNode.removeChild(script);
      resolve();
    };

    script.src =
      GAS_API_URL +
      "?action=masters&callback=" +
      encodeURIComponent(callbackName);

    script.onerror = function() {
      alert("マスタ情報を読み込めませんでした");
      delete window[callbackName];
      if (script.parentNode) script.parentNode.removeChild(script);
      resolve();
    };

    document.body.appendChild(script);
  });
}

