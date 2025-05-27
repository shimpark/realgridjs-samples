var gridView;
var dataProvider;

// Global state variables
let currentPage = 1;
const pageSize = 10; // Default page size
let currentSortBy = "id"; // Default sort field
let currentSortOrder = "asc"; // Default sort order
let currentSearchQuery = "";
let totalRecords = 0;

$(document).ready(function () {
  RealGrid.setLocale("ko");

  dataProvider = new RealGrid.LocalDataProvider(false); // false for async data loading
  gridView = new RealGrid.GridView("realgrid");
  gridView.setDataSource(dataProvider);

  // Define Fields based on dummyjson.com/posts structure
  const fields = [
    { fieldName: "id", dataType: "number" },
    { fieldName: "title", dataType: "text" },
    { fieldName: "body", dataType: "text" },
    { fieldName: "userId", dataType: "number" },
    { fieldName: "tags", dataType: "object" }, // Assuming tags is an array
    { fieldName: "reactions", dataType: "number" },
  ];
  dataProvider.setFields(fields);

  // Define Columns
  const columns = [
    {
      name: "id",
      fieldName: "id",
      width: "50",
      header: { text: "ID" },
      editor: { type: "number", readOnly: true },
      sortable: true,
    },
    {
      name: "title",
      fieldName: "title",
      width: "250",
      header: { text: "제목" },
      styleName: "left-column",
      sortable: true,
    },
    {
      name: "body",
      fieldName: "body",
      width: "400",
      header: { text: "내용" },
      styleName: "left-column",
      sortable: true,
    },
    {
      name: "userId",
      fieldName: "userId",
      width: "70",
      header: { text: "사용자ID" },
      sortable: true,
    },
    {
      name: "tags",
      fieldName: "tags",
      width: "150",
      header: { text: "태그" },
      valueCallback: function (grid, item, fieldName, index, value) {
        return Array.isArray(value) ? value.join(", ") : "";
      },
      sortable: true, // Assuming tags can be sorted by their string representation
    },
    {
      name: "reactions",
      fieldName: "reactions",
      width: "80",
      header: { text: "반응 수" },
      sortable: true,
    },
  ];
  gridView.setColumns(columns);

  // Grid options
  gridView.setOptions({
    display: { fitStyle: "evenFill" },
    header: { height: 40 },
    footer: { visible: false },
    checkBar: { visible: false },
    stateBar: { visible: false },
    fixed: { colCount: 0 },
    edit: { editable: false }, // Data from API is typically read-only on client
    // sortMode: "exclusive", // This is implicitly handled by sorting.style
    sorting: {
      enabled: true, // Enable header click for sorting UI
      style: "exclusive", // Ensures single column sort, provides fields/directions to onSorting
      keepFocusedCell: true,
    },
  });

  // Disable RealGrid's internal paging as pagination.js will handle it
  gridView.setPaging(false);

  // Setup event handlers
  setupSorting();
  setupSearch();

  // Initial data load
  fetchDataAndInitializePagination();
});

/**
 * 최초 데이터 로드 및 페이징 초기화 함수
 * - 페이지네이션을 위해 전체 데이터 개수를 가져오고, 첫 페이지 데이터를 로드한다.
 */
function fetchDataAndInitializePagination() {
  // currentSearchQuery, currentSortBy, currentSortOrder를 사용하여 1페이지 데이터 요청
  fetchData(1, pageSize, currentSortBy, currentSortOrder, currentSearchQuery);
}

/**
 * 서버에서 데이터를 가져와 그리드에 바인딩하고, 페이징/정렬 상태를 갱신한다.
 * @param {number} page - 요청할 페이지 번호
 * @param {number} limit - 페이지당 데이터 개수
 * @param {string} sortBy - 정렬 기준 필드명
 * @param {string} sortOrder - 정렬 방향(asc/desc)
 * @param {string} searchQuery - 검색어(없으면 전체)
 */
function fetchData(page, limit, sortBy, sortOrder, searchQuery) {
  console.log("fetchData", page, limit, sortBy, sortOrder, searchQuery);
  currentPage = page; // 현재 페이지 갱신

  let url = "https://dummyjson.com/posts";
  const params = {
    limit: limit,
    skip: (page - 1) * limit,
    sortBy: sortBy,
    order: sortOrder,
  };

  // 검색어가 있으면 검색 API 사용(정렬 파라미터 제거)
  if (searchQuery) {
    url = `https://dummyjson.com/posts/search`;
    params.q = searchQuery;
    delete params.sortBy;
    delete params.order;
    console.warn(
      "Sorting may not be applied when searching with dummyjson API."
    );
  }

  console.log("fetchData", url, params);

  //gridView.showLoading(); // Show loading indicator

  $.ajax({
    url: url,
    type: "GET",
    data: params,
    dataType: "json",
    success: function (response) {
      if (response && response.posts) {
        dataProvider.fillJsonData(response.posts, { fillMode: "set" });
        totalRecords = response.total;
        setupPagination(currentPage);
        gridView.setFocus();

        console.log("fetchData", currentSortBy, currentSortOrder);
        // [추가] 정렬 아이콘 다시 세팅
        if (currentSortBy) {
          gridView.setColumnProperty(
            currentSortBy,
            "sortDirection",
            currentSortOrder === "asc" ? "ascending" : "descending"
          );
        }
      } else {
        console.error("API response format error:", response);
        dataProvider.clearRows();
        totalRecords = 0;
        setupPagination(currentPage); // Still update pagination (will clear it if totalRecords is 0)
      }
    },
    error: function (xhr, status, error) {
      console.error("Error fetching data: ", status, error);
      dataProvider.clearRows();
      totalRecords = 0;
      setupPagination(currentPage); // Update pagination to show no data
    },
    complete: function () {
      //gridView.hideLoading(); // Hide loading indicator
    },
  });
}

/**
 * 그리드 컬럼 헤더 클릭 시 정렬 동작을 제어하는 이벤트 핸들러를 등록한다.
 * - 서버 정렬 방식이므로, 정렬 상태를 직접 관리하고, 내부 정렬은 막는다.
 * - 같은 컬럼 클릭 시 asc/desc 토글, 다른 컬럼 클릭 시 asc로 초기화
 * - 정렬 아이콘도 직접 세팅
 */
function setupSorting() {
  // 기존 핸들러 제거(중복 방지)
  if (gridView.onColumnHeaderClicked) {
    gridView.onColumnHeaderClicked = null;
  }
  if (gridView.onSortingChanged) {
    gridView.onSortingChanged = null;
  }

  gridView.onSorting = function (grid, fields, directions) {
    // fields[0]: 클릭한 컬럼 인덱스
    const fieldIndex = fields[0];
    const column = grid.getColumns()[fieldIndex];
    if (!column || !column.fieldName) return true;

    // 정렬 필드/방향 직접 토글
    if (currentSortBy === column.fieldName) {
      currentSortOrder = currentSortOrder === "asc" ? "desc" : "asc";
    } else {
      currentSortBy = column.fieldName;
      currentSortOrder = "asc";
    }

    // 모든 컬럼의 sortDirection 초기화
    grid.getColumns().forEach((col) => {
      grid.setColumnProperty(col.fieldName, "sortDirection", null);
    });

    // 현재 컬럼에만 sortDirection 세팅(아이콘 표시)
    grid.setColumnProperty(
      currentSortBy,
      "sortDirection",
      currentSortOrder === "asc" ? "ascending" : "descending"
    );

    // 1페이지로 이동(실제 데이터는 fetchData에서 로드)
    $("#pagination-container").pagination("go", 1);

    // return false; // 내부 정렬 막기(서버 정렬만 사용)
  };
  console.log("Sorting setup with onSorting handler.");
}

/**
 * 검색 버튼/엔터 입력 시 검색어로 서버 데이터 재조회
 * - 검색 시 1페이지로 이동
 */
function setupSearch() {
  $("#searchButton").on("click", function () {
    currentSearchQuery = $("#searchInput").val();
    // 검색어로 1페이지 데이터 요청
    fetchData(1, pageSize, currentSortBy, currentSortOrder, currentSearchQuery);
  });

  $("#searchInput").on("keypress", function (e) {
    if (e.which === 13) {
      // 엔터 입력 시 검색
      $("#searchButton").click();
    }
  });
}

function setupPagination(targetPage) {
  // If a previous instance exists, destroy it to prevent conflicts or duplicate paginators
  if ($("#pagination-container").data("pagination")) {
    $("#pagination-container").pagination("destroy");
  }

  if (totalRecords <= 0) {
    // Also check for <= 0
    $("#pagination-container").html(""); // Clear the container if no records
    console.log("Pagination: No records to display.");
    return;
  }

  $("#pagination-container").pagination({
    dataSource: function (done) {
      // Still provide a dummy dataSource for structure if library requires it
      let dummyData = [];
      for (let i = 1; i <= totalRecords; i++) dummyData.push(i);
      done(dummyData);
    },
    totalNumber: totalRecords,
    pageSize: pageSize,
    pageNumber: targetPage || currentPage, // Set the initial page number
    showPrevious: true,
    showNext: true,
    callback: function (data, pagination) {
      // data is from dataSource, pagination is the state
      // Check if the page number from the callback is different from our global currentPage
      // This prevents re-fetching if we programmatically set the page which then triggers callback
      if (currentPage !== pagination.pageNumber) {
        fetchData(
          pagination.pageNumber,
          pageSize,
          currentSortBy,
          currentSortOrder,
          currentSearchQuery
        );
      }
    },
  });
  console.log(
    `Pagination setup/updated: total=${totalRecords}, current page=${
      targetPage || currentPage
    }`
  );
}
