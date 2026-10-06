// ==========================================================================
// 0. Supabase 설정 (URL과 KEY를 직접 입력해주세요)
// ==========================================================================
// 1) Supabase 대시보드 -> Project Settings -> API에서 확인한 Project URL
const SUPABASE_URL = 'https://cqiwvyajelabblwkklhb.supabase.co';

// 2) Supabase 대시보드 -> Project Settings -> API에서 확인한 anon / public API 키
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNxaXd2eWFqZWxhYmJsd2trbGhiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTA2Mjk0MzMsImV4cCI6MjEwNjIwNTQzM30.eCacX5PYXHkBntWgfesZD1j-JFTIEdeORxFEov43f8k';

// Supabase 클라이언트 초기화 (index.html에서 CDN으로 불러온 supabase 객체 사용)
let supabaseClient = (window.supabase && SUPABASE_URL !== 'YOUR_SUPABASE_URL')
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
  : (window.supabase ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY) : null);


// ==========================================================================
// 1. HTML 요소(DOM) 가져오기
// ==========================================================================
// 탭 관련 요소
const tabBtnOrder = document.getElementById('tab-btn-order');
const tabBtnHistory = document.getElementById('tab-btn-history');
const tabContentOrder = document.getElementById('tab-content-order');
const tabContentHistory = document.getElementById('tab-content-history');
const orderCountBadge = document.getElementById('order-count-badge');

// 폼 및 입력 항목 요소
const orderForm = document.getElementById('order-form');
const submitButton = document.getElementById('submit-button');
const customerNameInput = document.getElementById('customer-name');
const customerPhoneInput = document.getElementById('customer-phone');
const beverageSelect = document.getElementById('beverage-select');
const quantityInput = document.getElementById('quantity');
const requestsInput = document.getElementById('requests');
const sizeRadios = document.querySelectorAll('input[name="size"]');
const optionCheckboxes = document.querySelectorAll('input[name="options"]');

// 화면 표시 영역 요소
const totalPriceElement = document.getElementById('total-price');       // 예상 금액 숫자 span
const orderSummary = document.getElementById('order-summary');          // 주문 완료 확인 메시지 박스
const ordersList = document.getElementById('orders-list');              // 주문 내역 목록 컨테이너
const ordersFooter = document.getElementById('orders-footer');          // 주문 내역 하단 통계 영역
const ordersTotalSummary = document.getElementById('orders-total-summary'); // 총 금액 및 건수 표시 텍스트
const clearAllOrdersBtn = document.getElementById('clear-all-orders-btn');   // 내역 모두 지우기 버튼


// ==========================================================================
// 2. 주문 내역 상태(데이터) 관리
// ==========================================================================
// 접수된 주문 객체들을 저장할 로컬 배열
let orders = [];

// 주문 번호 카운터 (#1부터 1씩 증가)
let orderSequence = 1;


// ==========================================================================
// 3. 탭 전환 기능
// ==========================================================================
/**
 * 탭 메뉴를 클릭했을 때 화면을 전환하는 함수
 * @param {'order' | 'history'} targetTab - 전환할 탭 이름
 */
function switchTab(targetTab) {
  if (targetTab === 'order') {
    // 주문하기 탭 활성화
    tabBtnOrder.classList.add('active');
    tabBtnHistory.classList.remove('active');

    tabContentOrder.hidden = false;
    tabContentOrder.classList.remove('hidden');

    tabContentHistory.hidden = true;
    tabContentHistory.classList.add('hidden');
  } else if (targetTab === 'history') {
    // 주문 내역 탭 활성화
    tabBtnOrder.classList.remove('active');
    tabBtnHistory.classList.add('active');

    tabContentOrder.hidden = true;
    tabContentOrder.classList.add('hidden');

    tabContentHistory.hidden = false;
    tabContentHistory.classList.remove('hidden');

    // 주문 내역 화면 최신화
    renderOrders();
  }
}

tabBtnOrder.addEventListener('click', () => switchTab('order'));
tabBtnHistory.addEventListener('click', () => switchTab('history'));


// ==========================================================================
// 4. 금액 계산 함수 (calculateTotal)
// ==========================================================================
/**
 * 음료, 사이즈, 옵션, 수량을 바탕으로 총 예상 금액을 계산하고
 * 화면의 "예상 금액" 숫자를 천 단위 콤마(toLocaleString)로 업데이트합니다.
 * @returns {number} 계산된 총 금액 (원)
 */
function calculateTotal() {
  const selectedBeverage = beverageSelect.options[beverageSelect.selectedIndex];

  // [조건] 음료를 아직 선택하지 않았다면 0원으로 표시
  if (!beverageSelect.value) {
    totalPriceElement.textContent = "0";
    return 0;
  }

  // 1) 음료 기본 가격 (data-price 속성 읽기)
  const beveragePrice = Number(selectedBeverage.dataset.price) || 0;

  // 2) 선택된 사이즈 추가 금액
  const selectedSize = document.querySelector('input[name="size"]:checked');
  const sizePrice = selectedSize ? (Number(selectedSize.dataset.price) || 0) : 0;

  // 3) 선택된 추가 옵션들의 금액 합산
  const checkedOptions = document.querySelectorAll('input[name="options"]:checked');
  let optionsPrice = 0;
  checkedOptions.forEach((option) => {
    optionsPrice += Number(option.dataset.price) || 0;
  });

  // 4) 수량 (1 미만이거나 빈 값일 경우 1로 보정)
  let quantity = parseInt(quantityInput.value, 10);
  if (isNaN(quantity) || quantity < 1) {
    quantity = 1;
  }

  // 총 예상 금액 계산: (음료 + 사이즈 + 옵션) * 수량
  const cupPrice = beveragePrice + sizePrice + optionsPrice;
  const total = cupPrice * quantity;

  // 천 단위 콤마 적용 후 화면에 표시
  totalPriceElement.textContent = total.toLocaleString();

  return total;
}


// ==========================================================================
// 5. 주문 내역 화면 그리기 (renderOrders)
// ==========================================================================
/**
 * orders 배열을 바탕으로 주문 내역 목록과 건수 배지, 총 금액을 다시 그리는 함수
 * 보안을 위해 손님이 입력한 내용은 innerHTML 대신 textContent로만 삽입합니다.
 */
function renderOrders() {
  // 1) 탭 옆의 건수 배지 업데이트
  if (orderCountBadge) {
    orderCountBadge.textContent = orders.length;
  }

  // 2) 기존에 그려진 주문 카드 목록 깨끗하게 비우기
  ordersList.textContent = '';

  // 3) 접수된 주문이 하나도 없을 때
  if (orders.length === 0) {
    const emptyMessage = document.createElement('div');
    emptyMessage.className = 'empty-orders';
    emptyMessage.textContent = '아직 주문 내역이 없어요 ☕';
    ordersList.appendChild(emptyMessage);

    // 하단 총 금액 및 전체 삭제 버튼 숨기기
    ordersFooter.hidden = true;
    ordersFooter.classList.add('hidden');
    return;
  }

  // 4) 주문이 있을 때: 하단 총 금액 영역 표시
  ordersFooter.hidden = false;
  ordersFooter.classList.remove('hidden');

  // 총 누적 금액 계산
  const totalAmount = orders.reduce((sum, order) => sum + order.totalPrice, 0);
  ordersTotalSummary.textContent = `총 주문 금액: ${totalAmount.toLocaleString()}원 (${orders.length}건)`;

  // 5) 최신 주문 순서대로 카드 엘리먼트 생성하여 추가
  orders.forEach((order) => {
    // 주문 카드 컨테이너 (베이지 카드 + 왼쪽 갈색 세로줄)
    const card = document.createElement('div');
    card.className = 'order-card';

    // 카드 오른쪽 상단 "취소" 버튼
    const cancelBtn = document.createElement('button');
    cancelBtn.type = 'button';
    cancelBtn.className = 'order-cancel-btn';
    cancelBtn.textContent = '취소';
    cancelBtn.addEventListener('click', () => {
      // confirm으로 한 번 더 확인 후 취소
      const isConfirmed = confirm(`주문 #${order.id} (${order.customerName}님) 내역을 취소하시겠습니까?`);
      if (isConfirmed) {
        // 배열에서 해당 주문 제거 후 다시 그리기
        orders = orders.filter((item) => item.id !== order.id);
        renderOrders();
      }
    });

    // 1줄: "#1 [매장/포장] 홍길동님 (010-1234-5678) · 5,000원"
    const titleLine = document.createElement('div');
    titleLine.className = 'order-card-title';

    // 매장 / 포장 태그 뱃지 생성
    const typeBadge = document.createElement('span');
    typeBadge.className = `order-type-tag ${order.orderType === '포장' ? 'takeout' : 'dine-in'}`;
    typeBadge.textContent = order.orderType || '매장';

    const phoneText = order.phone ? ` (${order.phone})` : ' (연락처 없음)';

    titleLine.appendChild(document.createTextNode(`#${order.id} `));
    titleLine.appendChild(typeBadge);
    titleLine.appendChild(document.createTextNode(` ${order.customerName}님${phoneText} · ${order.totalPrice.toLocaleString()}원`));

    // 2줄: "카페라떼 (3,500원) · M사이즈 · 옵션: 샷 추가 · 1잔"
    const detailLine = document.createElement('div');
    detailLine.className = 'order-card-detail';
    const drinkPriceText = order.beveragePrice ? ` (${order.beveragePrice.toLocaleString()}원)` : '';
    const optionsText = (order.options && order.options.length > 0)
      ? `옵션: ${order.options.join(', ')}`
      : '옵션: 없음';
    detailLine.textContent = `${order.beverageName}${drinkPriceText} · ${order.sizeText} · ${optionsText} · ${order.quantity}잔`;

    // 3줄: "요청사항: 얼음 적게 · 주문 시간: 오후 12:43" (생략 없이 표시)
    const metaLine = document.createElement('div');
    metaLine.className = 'order-card-meta';
    const requestText = order.requests ? order.requests : '없음';
    metaLine.textContent = `요청사항: ${requestText} · 주문 시간: ${order.orderTime}`;

    // 카드에 순서대로 자식 요소 조립
    card.appendChild(cancelBtn);
    card.appendChild(titleLine);
    card.appendChild(detailLine);
    card.appendChild(metaLine);

    // 주문 목록 컨테이너에 카드 삽입
    ordersList.appendChild(card);
  });
}

// "내역 모두 지우기" 버튼 클릭 시
clearAllOrdersBtn.addEventListener('click', function () {
  if (confirm('주문 내역을 모두 지우시겠습니까?')) {
    orders = [];
    renderOrders();
  }
});


// ==========================================================================
// 6. 실시간 변경 이벤트 연결
// ==========================================================================
// 전화번호: 기본 010 제공 + 자유로운 삭제/수정 및 하이픈 자동 포맷팅
if (customerPhoneInput) {
  customerPhoneInput.addEventListener('input', function () {
    let numbers = this.value.replace(/[^0-9]/g, '');

    if (!numbers) {
      this.value = '';
      return;
    }

    numbers = numbers.slice(0, 11);

    if (numbers.length <= 3) {
      this.value = numbers;
    } else if (numbers.length <= 7) {
      this.value = numbers.slice(0, 3) + '-' + numbers.slice(3);
    } else {
      this.value = numbers.slice(0, 3) + '-' + numbers.slice(3, 7) + '-' + numbers.slice(7);
    }
  });
}

// 음료, 사이즈, 옵션, 수량 변경 시 실시간 금액 재계산
beverageSelect.addEventListener('change', calculateTotal);

sizeRadios.forEach((radio) => {
  radio.addEventListener('change', calculateTotal);
});

optionCheckboxes.forEach((checkbox) => {
  checkbox.addEventListener('change', calculateTotal);
});

quantityInput.addEventListener('input', calculateTotal);
quantityInput.addEventListener('change', calculateTotal);


// ==========================================================================
// 7. 주문하기 버튼 클릭 (유효성 검사 및 Supabase orders 테이블에 저장)
// ==========================================================================
orderForm.addEventListener('submit', async function (event) {
  event.preventDefault();

  const name = customerNameInput.value.trim();

  // [유효성 검사 1] 이름 필수 입력 확인
  if (!name) {
    alert("이름을 입력해주세요");
    customerNameInput.focus();
    return;
  }

  // [유효성 검사 2] 음료 선택 확인
  if (!beverageSelect.value) {
    alert("음료를 선택해주세요");
    beverageSelect.focus();
    return;
  }

  // 1) 선택된 음료 정보 가져오기
  const selectedBeverage = beverageSelect.options[beverageSelect.selectedIndex];
  const beverageName = selectedBeverage.text.replace(/\s*\([^)]*\)/, '').trim();
  const beveragePrice = Number(selectedBeverage.dataset.price) || 0;

  // 2) 선택된 사이즈 텍스트 가져오기
  const selectedSize = document.querySelector('input[name="size"]:checked');
  const sizeValue = selectedSize ? selectedSize.value : 'M';
  const sizeText = sizeValue + '사이즈';

  // 3) 선택된 추가 옵션 목록 가져오기 (배열 및 텍스트)
  const checkedOptions = document.querySelectorAll('input[name="options"]:checked');
  let optionNames = [];
  let optionString = '';

  if (checkedOptions.length > 0) {
    optionNames = Array.from(checkedOptions).map((option) => {
      const label = document.querySelector(`label[for="${option.id}"]`);
      return label ? label.textContent.replace(/\s*\([^)]*\)/, '').trim() : option.value;
    });
    optionString = ` (${optionNames.join(', ')})`;
  }

  // 4) 수량 및 총 금액 계산
  const quantity = parseInt(quantityInput.value, 10) || 1;
  const total = calculateTotal();
  const formattedTotal = total.toLocaleString() + '원';

  // 5) 현재 시간 포맷팅 (예: "오후 12:43")
  const now = new Date();
  const timeString = now.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  // 6) 이용 방식(매장 or 포장) 가져오기
  const selectedOrderType = document.querySelector('input[name="orderType"]:checked');
  const orderType = selectedOrderType ? selectedOrderType.value : '매장';

  // 전화번호 및 요청사항
  const phone = customerPhoneInput ? customerPhoneInput.value.trim() : '';
  const request = requestsInput ? requestsInput.value.trim() : '';

  // 7) Supabase orders 테이블에 저장 시도
  // 버튼 비활성화 (중복 클릭 방지)
  const originalButtonText = submitButton.textContent;
  submitButton.disabled = true;
  submitButton.textContent = '주문 저장 중...';

  try {
    // Supabase 클라이언트가 미초기화된 경우 다시 연결 시도
    if (!supabaseClient && window.supabase) {
      supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    }

    if (!supabaseClient) {
      throw new Error("Supabase 클라이언트가 초기화되지 않았습니다. SUPABASE_URL과 SUPABASE_KEY를 확인해주세요.");
    }

    // Supabase orders 테이블에 주문 데이터 삽입 (테이블의 실제 컬럼명과 100% 일치)
    const { data, error } = await supabaseClient
      .from('orders')
      .insert([
        {
          order_type: orderType,            // 매장 or 포장
          customer_name: name,              // 고객 이름
          customer_phone: phone || null,    // 전화번호 (실제 컬럼명: customer_phone)
          beverage: beverageName,           // 음료명 (실제 컬럼명: beverage)
          size: sizeValue,                  // 사이즈 ('S', 'M', 'L')
          options: optionNames,             // 옵션 배열: ['샷 추가', ...]
          quantity: quantity,               // 수량
          requests: request || null,        // 요청사항 (실제 컬럼명: requests)
          total_price: total                // 총 금액
        }
      ]);

    // 에러 발생 시 처리
    if (error) {
      console.error("주문 저장 에러:", error);
      alert("주문 저장에 실패했어요");
      return;
    }

    // 8) 저장 성공 시: 로컬 주문 내역에도 생략 없이 모든 정보 추가
    const newOrder = {
      id: orderSequence++,
      orderType: orderType,
      customerName: name,
      phone: phone,
      beverageName: beverageName,
      beveragePrice: beveragePrice,
      sizeText: sizeText,
      options: optionNames,
      quantity: quantity,
      requests: request || '없음',
      totalPrice: total,
      orderTime: timeString
    };

    orders.unshift(newOrder);

    // 주문 내역 탭 목록 및 건수 배지 갱신
    renderOrders();

    // 9) 성공 시 모든 항목이 생략되지 않은 상세 주문 확인 메시지 표시
    const optionsText = optionNames.length > 0 ? optionNames.join(', ') : '없음';
    const requestText = request || '없음';
    const phoneDisplay = phone ? ` (${phone})` : '';

    const resultMessage = `${name}님${phoneDisplay}, [${orderType}] ${beverageName}(${beveragePrice.toLocaleString()}원) ${sizeText} (옵션: ${optionsText}) ${quantity}잔 / 요청사항: ${requestText} · 총 ${formattedTotal} 주문이 정상 접수되었습니다!`;
    orderSummary.textContent = resultMessage;
    orderSummary.hidden = false;
    orderSummary.classList.remove('hidden');

    // 메시지 위치로 부드럽게 스크롤
    orderSummary.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  } catch (err) {
    console.error("주문 저장 에러:", err);
    alert("주문 저장에 실패했어요");
  } finally {
    // 저장 완료 또는 에러 후 주문하기 버튼 다시 활성화
    submitButton.disabled = false;
    submitButton.textContent = originalButtonText;
  }
});


// ==========================================================================
// 8. 다시 작성 버튼 클릭 (주문서만 초기화하고 주문 내역은 유지)
// ==========================================================================
orderForm.addEventListener('reset', function () {
  setTimeout(() => {
    // 전화번호 010- 유지
    if (customerPhoneInput) {
      customerPhoneInput.value = '010-';
    }

    // 예상 금액 0원으로 재계산
    calculateTotal();

    // 주문 확인 메시지 영역 숨기기
    orderSummary.hidden = true;
    orderSummary.classList.add('hidden');
    orderSummary.textContent = '';
  }, 0);
});


// ==========================================================================
// 9. 초기 화면 세팅
// ==========================================================================
calculateTotal(); // 초기 금액 0원 설정
renderOrders();   // 초기 주문 내역("아직 주문 내역이 없어요 ☕") 렌더링
