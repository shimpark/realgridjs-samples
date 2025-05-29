/*eslint-disable*/

var fields = [
  { fieldName: "id", dataType: "number" },
  { fieldName: "title", dataType: "text" },
  { fieldName: "body", dataType: "text" },
  { fieldName: "userId", dataType: "number" },
  { fieldName: "tags", dataType: "text" },
  { fieldName: "reactions", dataType: "number" },
];

var columns = [
  {
    name: "id",
    fieldName: "id",
    width: "40",
    header: { text: "ID" },
    sortable: true,
  },
  {
    name: "title",
    fieldName: "title",
    width: "200",
    header: { text: "제목" },
    sortable: true,
  },
  {
    name: "body",
    fieldName: "body",
    width: "300",
    header: { text: "본문" },
    sortable: true,
  },
  {
    name: "userId",
    fieldName: "userId",
    width: "60",
    header: { text: "UserID" },
    sortable: true,
  },
  {
    name: "tags",
    fieldName: "tags",
    width: "120",
    header: { text: "태그" },
    sortable: true,
  },
  {
    name: "reactions",
    fieldName: "reactions",
    width: "60",
    header: { text: "반응수" },
    sortable: true,
  },
];

var dataProvider, gridView;
var currentPage = 1;
var dataPerPage = 8;
var currentSortBy = "id";
var currentOrder = "desc";
var totalRows = 0;
var currentSearchQuery = "";
var isServerSorting = false;

// 서버에서 데이터 받아오기
function fetchData(
  { page = 1, limit = 8, query = currentSearchQuery },
  callback
) {
  var skip = (page - 1) * limit;
  var url;

  if (query) {
    // 검색어가 있는 경우
    url = `https://dummyjson.com/posts/search?q=${encodeURIComponent(
      query
    )}&limit=${limit}&skip=${skip}`;

    if (currentSortBy && currentOrder) {
      url += `&sortBy=${currentSortBy}&order=${currentOrder}`;
    }
  } else {
    // 검색어가 없는 경우 (기존 로직)
    url = `https://dummyjson.com/posts?limit=${limit}&skip=${skip}`;
    if (currentSortBy && currentOrder) {
      url += `&sortBy=${currentSortBy}&order=${currentOrder}`;
    }
  }

  console.log("fetchData url", url);

  fetch(url)
    .then((res) => res.json())
    .then((json) => {
      var rows = json.posts.map((post) => ({
        ...post,
        tags: Array.isArray(post.tags) ? post.tags.join(", ") : post.tags,
      }));
      if (callback) callback(rows, json.total);
    });
}

function createGrid(container) {
  dataProvider = new RealGrid.LocalDataProvider();
  gridView = new RealGrid.GridView(container);

  gridView.setDataSource(dataProvider);
  dataProvider.setFields(fields);
  gridView.setColumns(columns);

  gridView.displayOptions.emptyMessage = "표시할 데이타가 없습니다.";
  gridView.displayOptions.rowHeight = 36;
  gridView.header.height = 40;
  gridView.footer.height = 40;
  gridView.stateBar.width = 16;
  gridView.editOptions.insertable = false;
  gridView.editOptions.appendable = false;
  gridView.sortingOptions.enabled = true;

  // 첫 페이지 데이터 로딩
  fetchData(
    {
      page: currentPage,
      limit: dataPerPage,
      query: currentSearchQuery, // 초기 검색어 전달 (빈 문자열)
    },
    function (rows, total) {
      dataProvider.setRows(rows);
      totalRows = total;
      setPaging();
    }
  );

  // onSorting 이벤트를 활용한 서버 정렬
  gridView.onSorting = function (grid, fields, dirs) {
    if (!fields || !dirs || fields.length === 0 || dirs.length === 0) {
      currentSortBy = "id";
      currentOrder = "desc";
    } else {
      var sortIndex = fields[0];
      currentSortBy =
        typeof sortIndex === "number"
          ? columns[sortIndex].fieldName
          : sortIndex;
      currentOrder = dirs[0] === "ascending" ? "asc" : "desc";
    }

    // 반드시 플러그인 메서드로 1페이지 이동
    console.log("== onSorting currentPage", currentPage);
    if (currentPage !== 1) {
      $("#page").pagination("go", 1);
    } else {
      // 1페이지로 강제 콜백 실행
      onPageChange([], { pageNumber: 1 });
    }
  };
}

function start() {
  createGrid("realgrid");

  // 검색 버튼 이벤트 리스너 추가
  var searchButton = document.getElementById("searchButton");
  var searchInput = document.getElementById("searchInput");

  if (searchButton && searchInput) {
    searchButton.addEventListener("click", function () {
      currentSearchQuery = searchInput.value;
      console.log("Search button clicked. Query:", currentSearchQuery);

      var targetPage = 1;

      //currentPage = targetPage; // 검색 시 항상 첫 페이지로 설정

      if (currentPage === targetPage && $("#page").data("pagination")) {
        // 현재 페이지가 1페이지이고 페이지네이션이 이미 초기화된 경우,
        // pagination("go", 1)이 콜백을 트리거하지 않을 수 있으므로 fetchData와 setPaging을 직접 호출합니다.
        console.log(
          "Search on page 1: Fetching data directly and resetting pagination."
        );
        currentPage = targetPage; // currentPage를 명시적으로 설정
        fetchData(
          {
            page: currentPage,
            limit: dataPerPage,
            query: currentSearchQuery,
          },
          function (rows, total) {
            dataProvider.setRows(rows);
            totalRows = total;
            setPaging(); // 검색 결과에 따라 페이지네이션을 다시 설정합니다.
          }
        );
      } else if ($("#page").data("pagination")) {
        // 현재 페이지가 1페이지가 아니거나 페이지네이션이 초기화된 경우,
        // pagination("go", 1)을 호출하여 페이지네이션 콜백을 통해 데이터를 로드합니다.
        console.log(
          "Search from another page or pagination ready: Using pagination('go', 1)."
        );
        // currentPage를 여기서 1로 설정하면, pagination 콜백 내의 `pagination.pageNumber !== currentPage` 조건이 false가 될 수 있습니다.
        // 콜백 함수가 currentPage를 기준으로 동작하도록 currentPage 변경은 콜백 내부 또는 직전에 이루어져야 합니다.
        // 혹은 pagination 라이브러리가 항상 콜백을 호출하도록 기대합니다.
        // 여기서는 onPageChange가 currentPage를 pagination.pageNumber 기준으로 설정하므로 go(1)만 호출합니다.
        $("#page").pagination("go", targetPage);
      } else {
        // 페이지네이션이 아직 초기화되지 않은 경우 (예: 초기 로딩 중 검색 시도 - 거의 없는 케이스)
        console.log(
          "Search with uninitialized pagination: Fetching data directly."
        );
        currentPage = targetPage; // currentPage를 명시적으로 설정
        fetchData(
          {
            page: currentPage,
            limit: dataPerPage,
            query: currentSearchQuery,
          },
          function (rows, total) {
            dataProvider.setRows(rows);
            totalRows = total;
            setPaging();
          }
        );
      }
    });

    // Enter 키로 검색 실행
    searchInput.addEventListener("keypress", function (event) {
      if (event.key === "Enter") {
        searchButton.click();
      }
    });
  }
}

// $.document.ready(start);
window.onload = start;
// domloaded를 대신 써도 됩니다.

window.onunload = function () {
  dataProvider.clearRows();

  gridView.destroy();
  dataProvider.destroy();

  gridView = null;
  dataProvider = null;
};

function pagination() {
  let container = $("#page");
  container.pagination({
    dataSource: function (done) {
      done(new Array(totalRows));
    },
    pageSize: dataPerPage,
    pageNumber: currentPage,
    callback: function (data, pagination) {
      if (
        pagination.pageNumber !== currentPage ||
        currentSearchQuery !== $("#searchInput").val()
      ) {
        // 페이지 번호가 변경되었거나, 검색어가 변경된 후 페이지네이션으로 인해 다시 호출된 경우
        currentPage = pagination.pageNumber;
        // currentSearchQuery는 검색 버튼 클릭 시 이미 업데이트 되었으므로, 여기서는 fetchData에만 전달
        fetchData(
          {
            page: currentPage,
            limit: dataPerPage,
            query: currentSearchQuery, // fetchData에 검색어 전달
          },
          function (rows, total) {
            dataProvider.setRows(rows);
            totalRows = total;
            // 검색 시에는 페이지네이션 dataSource가 변경되므로, 항상 setPaging()을 호출하여
            // 페이지네이션을 다시 그리도록 하는 것이 안전할 수 있으나,
            // 현재 pagination 라이브러리는 dataSource를 직접 업데이트하는 방식이 아니므로
            // totalRows만 업데이트해도 될 수 있습니다. 여기서는 totalRows만 업데이트합니다.
          }
        );
      }
    },
  });
}

function setPaging() {
  pagination();
}

function onPageChange(data, pagination) {
  // onSorting -> pagination.go(1) -> onPageChange 순으로 호출될 때,
  // pagination.pageNumber가 현재 페이지와 다를 수 있음.
  // fetchData 호출 시 항상 pagination.pageNumber를 사용하도록 함.
  currentPage = pagination.pageNumber;
  fetchData(
    {
      page: currentPage, // pagination.pageNumber 대신 currentPage 사용
      limit: dataPerPage,
      query: currentSearchQuery, // fetchData에 검색어 전달
    },
    function (rows, total) {
      dataProvider.setRows(rows);
      totalRows = total;
    }
  );
}
