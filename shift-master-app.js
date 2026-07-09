<script>
const shiftData = [
  {
    id: "S000001",
    historyId: "H000001",
    user: "山田 太郎",
    startDate: "2026-07-01",
    endDate: "",
    weekday: "月",
    startTime: "10:00",
    endTime: "12:00",
    people: "2人",
    service: "居宅介護",
    weekPattern: "",
    changeType: "通常",
    staff1: "塩田 美穂",
    staff2: "井滝 友宏",
    staff3: "",
    staff4: "",
    support: "買い物同行、帰宅後の整理",
    destination: "○○スーパー",
    meeting: "利用者宅",
    transport: "徒歩",
    note: ""
  }
];

let selectedIndex = 0;
let editMode = "update";

function qs(selector) {
  return document.querySelector(selector);
}

function qsa(selector) {
  return Array.from(document.querySelectorAll(selector));
}

function setValue(labelText, value) {
  const fields = qsa(".field");
  const field = fields.find(f => {
    const label = f.querySelector("label");
    return label && label.textContent.trim() === labelText;
  });

  if (!field) return;

  const input = field.querySelector("input, select, textarea");
  if (input) input.value = value || "";
}

function getValue(labelText) {
  const fields = qsa(".field");
  const field = fields.find(f => {
    const label = f.querySelector("label");
    return label && label.textContent.trim() === labelText;
  });

  if (!field) return "";

  const input = field.querySelector("input, select, textarea");
  return input ? input.value : "";
}

function renderList() {
  const list = qs(".shift-list");
  list.innerHTML = "";

  shiftData.forEach((item, index) => {
    const div = document.createElement("div");
    div.className = "shift-item" + (index === selectedIndex ? " selected" : "");

    div.innerHTML = `
      <div class="shift-line1">
        <span>${item.weekday}曜日</span>
        <span>${item.startTime}～${item.endTime}</span>
        <span class="shift-name">${item.user}</span>
      </div>
      <div class="shift-line2">
        <span>${item.service}</span>
        <span>${item.people}</span>
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

function loadToForm(item) {
  setValue("予定ID", item.id);
  setValue("履歴ID", item.historyId);
  setValue("利用者", item.user);
  setValue("適用開始日", item.startDate);
  setValue("適用終了日", item.endDate);
  setValue("曜日", item.weekday);
  setValue("開始", item.startTime);
  setValue("終了", item.endTime);
  setValue("人数", item.people);
  setValue("サービス区分", item.service);
  setValue("交代", item.changeType);
  setValue("担当1", item.staff1);
  setValue("担当2", item.staff2);
  setValue("担当3", item.staff3);
  setValue("担当4", item.staff4);
  setValue("支援内容", item.support);
  setValue("行き先場所", item.destination);
  setValue("待合せ場所", item.meeting);
  setValue("移動手段", item.transport);
  setValue("特記事項", item.note);

  qs("#weekPatternText").value = item.weekPattern || "";

  qsa("#weekPanel input").forEach(cb => {
    cb.checked = false;
    if (item.weekPattern === "" && cb.value === "毎") cb.checked = true;
    if (item.weekPattern && item.weekPattern.includes(cb.value)) cb.checked = true;
  });
}

function formToData() {
  return {
    id: getValue("予定ID") || createNewId(),
    historyId: getValue("履歴ID") || createNewHistoryId(),
    user: getValue("利用者"),
    startDate: getValue("適用開始日"),
    endDate: getValue("適用終了日"),
    weekday: getValue("曜日"),
    startTime: getValue("開始"),
    endTime: getValue("終了"),
    people: getValue("人数"),
    service: getValue("サービス区分"),
    weekPattern: qs("#weekPatternText").value,
    changeType: getValue("交代"),
    staff1: getValue("担当1"),
    staff2: getValue("担当2"),
    staff3: getValue("担当3"),
    staff4: getValue("担当4"),
    support: getValue("支援内容"),
    destination: getValue("行き先場所"),
    meeting: getValue("待合せ場所"),
    transport: getValue("移動手段"),
    note: getValue("特記事項")
  };
}

function clearForm() {
  setValue("予定ID", createNewId());
  setValue("履歴ID", createNewHistoryId());
  setValue("利用者", "");
  setValue("適用開始日", "");
  setValue("適用終了日", "");
  setValue("曜日", "月");
  setValue("開始", "");
  setValue("終了", "");
  setValue("人数", "1人");
  setValue("サービス区分", "居宅介護");
  setValue("交代", "通常");
  setValue("担当1", "");
  setValue("担当2", "");
  setValue("担当3", "");
  setValue("担当4", "");
  setValue("支援内容", "");
  setValue("行き先場所", "");
  setValue("待合せ場所", "");
  setValue("移動手段", "");
  setValue("特記事項", "");

  qs("#weekPatternText").value = "";
  qsa("#weekPanel input").forEach(cb => cb.checked = false);
}

function createNewId() {
  return "S" + String(shiftData.length + 1).padStart(6, "0");
}

function createNewHistoryId() {
  return "H" + String(shiftData.length + 1).padStart(6, "0");
}

function saveCurrent() {
  const data = formToData();

  if (editMode === "new") {
    shiftData.push(data);
    selectedIndex = shiftData.length - 1;
    editMode = "update";
  } else {
    shiftData[selectedIndex] = data;
  }

  renderList();
  alert("保存しました");
}

function cancelEdit() {
  if (editMode === "new") {
    if (shiftData.length > 0) {
      selectedIndex = 0;
      editMode = "update";
      loadToForm(shiftData[0]);
      renderList();
    } else {
      clearForm();
    }
    return;
  }

  loadToForm(shiftData[selectedIndex]);
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

  qs("#weekPatternText").value = text;
}

document.addEventListener("DOMContentLoaded", () => {
  qs(".new-button").addEventListener("click", () => {
    editMode = "new";
    selectedIndex = -1;
    clearForm();
    renderList();
  });

  qs(".save-button").addEventListener("click", saveCurrent);
  qs(".secondary-button").addEventListener("click", cancelEdit);

  renderList();
  loadToForm(shiftData[0]);
});
</script>