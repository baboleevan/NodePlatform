/**
 * 메인 스크립트
 * 
 */
;$(function(){

	function msgbox(content, title, buttons){
		$('#modalContent').html(content);
		$('#modalTitle').html(title);
		$modal = $('#commonMotal');
		buttons = buttons || {};

		var $btns = $modal.find('.modal-footer>button').not('#closeButton').remove().end().end();
		for(var label in buttons){
			if(label=='close'){
				$('#closeButton')[!!buttons[label] ? 'show' : 'hide']();
				continue;
			}
			var $btn = $('<button type="button" class="btn btn-default" ></button>')
			.text(label)
			.click(buttons[label])
			.appendTo($btns);
		}

		$modal.modal({
			backdrop: 'static',
			keyboard: false
		});
	}
	msgbox.close = function(){
		$('#commonMotal').modal('hide');
	}

	//공통코드
	var gender = ['남', '여']
	,part = ['총무팀','인사팀','영업팀','개발팀','홍보팀','경영지원팀']
	,rank = ['사원','주임','대리','과장','팀장'];

	//내장 DB 초기화 및 테이블 생성
	var db = new Database('demo_insa')
	,commit = {
		insert:[],
		update:[],
		remove:[]
	};

	db.then(function(){
		//테이블 정의
		db.query('CREATE TABLE IF NOT EXISTS insa(id INTEGER PRIMARY KEY ASC, name TEXT, gender TEXT, city TEXT, age INTEGER, part TEXT, rank TEXT, "join" DATETIME)')
		.then(function(){
				//데이터 확인 후 없으면 기본 데이터 넣기
				db.query("SELECT COUNT(*) AS cnt FROM insa")
				.then(function(rs){
					if(!rs.rows.length || !rs.rows.item(0).cnt){
						db.begin();
						getData().forEach(function(data){
							var kv={para:[], value:[]};
							for(var col in data){
								kv.para.push('?');
								kv.value.push(data[col]);
							}
							db.query.apply(db, ["INSERT INTO insa VALUES ("+kv.para.join(',')+")"].concat(kv.value.slice()));
						});
						db.execute(function(){
								//새로고침
								$('#btn_cancel').click();
							});
					}else{
							//새로고침
							$('#btn_cancel').click();
						}
						
					});
			});
	});

	//그리드 열 정의
	var grid;
	var columns = [
	{id: "name", name: "이름", field: "name", width: 100, cssClass:'tc', headerCssClass:'tc', editor: Slick.Editors.Text},
	{id: "gender", name: "성별", field: "gender", width: 50, cssClass:'tc', headerCssClass:'tc', editor: Slick.Editors.Select(gender), cannotTriggerInsert: true},
	{id: "city", name: "주소", field: "city", width: 50, cssClass:'tc', headerCssClass:'tc', editor: Slick.Editors.Text, cannotTriggerInsert: true},
	{id: "age", name: "나이", field: "age", width: 50, cssClass:'tc', headerCssClass:'tc', editor: Slick.Editors.Type('number'), cannotTriggerInsert: true},
	{id: "part", name: "부서", field: "part", width: 50, cssClass:'tc', headerCssClass:'tc', editor: Slick.Editors.Select(part), cannotTriggerInsert: true},
	{id: "rank", name: "직급", field: "rank", width: 50, cssClass:'tc', headerCssClass:'tc', editor: Slick.Editors.Select(rank), cannotTriggerInsert: true},
	{id: "join", name: "입사일", field: "join", width: 100, cssClass:'tc', headerCssClass:'tc', editor: Slick.Editors.Type('date'), cannotTriggerInsert: true}
	];
	//체크박스 활성화 후 맨 처음에 삽입
	var checkboxSelector = new Slick.CheckboxSelectColumn({
		cssClass: "slick-cell-checkboxsel"
	});
	columns.splice(0,0, checkboxSelector.getColumnDefinition());

	//그리드 옵션
	var options = {
		editable: true,
		enableAddRow: true,
		enableCellNavigation: true,
		asyncEditorLoading: true,
		autoEdit: true,
		enableColumnReorder: false,
		forceFitColumns: true,
		rowHeight: 35
	};

	// 데이터 관리 확장성을 위한 데이터뷰 초기화
	var dataView = new Slick.Data.DataView({ inlineFilters: true });
	//그리드 초기화 후 행 단위 선택으로 정의
	grid = new Slick.Grid("#myGrid", dataView, columns, options);
	grid.setSelectionModel(new Slick.RowSelectionModel({selectActiveRow: false}));
	// 체크박스 모델 초기화
	grid.registerPlugin(checkboxSelector);

	// 행 변경 발생 시 그리드 새로고침
	dataView.onRowCountChanged.subscribe(function (e, args) {
		grid.updateRowCount();
		grid.render();
	});
	// 행 변경 발생시 그리드 새로고침
	dataView.onRowsChanged.subscribe(function (e, args) {
		grid.invalidateRows(args.rows);
		grid.render();
	});

	// 행 삽입시 기본값 삽입
	grid.onAddNewRow.subscribe(function (e, args) {
		var now = new Date();
		var newid = (function(data){
			return data.length ? data.slice().sort(function(a,b){
				return b.id - a.id;
			})[0].id || 0 : 0;
		})(dataView.getItems());
		var item = {
			"id": newid + 1,
			"name": "새 이름",
			"city": "서울",
			"gender": "남",
			"age": 20,
			"part": "총무팀",
			"rank": "사원",
			"join": [now.getFullYear(), ('00'+(now.getMonth()+1)).slice(-2), ('00'+(now.getDate())).slice(-2)].join('-'),
			"isNew": true //DB에 없는 값 의미
		};
		$.extend(item, args.item);
		dataView.addItem(item);
		//삽입 대기열 추가
		commit.insert.push(item);
	});

	// 행 수정시 그리드에 적용
	grid.onCellChange.subscribe(function (e, args) {
		dataView.updateItem(args.item.id, args.item);
		//수정 대기열에 추가. 중복 방지를 위해 기존 행 위치에 삽입하도록
		commit.update[args.row] = args.item;
	});

	

	// 행 선택기 작동
	var columnpicker = new Slick.Controls.ColumnPicker(columns, grid, options);

	// 윈도우 사이즈 조절시 마다 그리드 크기 조정
	$(window).resize(function(){
		grid.resizeCanvas();
	});

	// 검색 시 필터링 작동
	var form = $('#search_form').submit(function(e){
		e.preventDefault();
		var search = this.elements.search, val = search.value;

		Slick.GlobalEditorLock.cancelCurrentEdit();
		dataView.setFilterArgs({
			name: val
		});
		dataView.refresh();

		return false;
	});

	// 데이터 필터링 초기화
	dataView.beginUpdate();
	dataView.setItems([]);
	dataView.setFilterArgs({
		name: ''
	});
	dataView.setFilter(function(item, args){
		if (args.name != "" && item.name.indexOf(args.name) == -1) {
			return false;
		}

		return true;
	});
	dataView.endUpdate();
	
	// 데이터뷰와 그리드 동기화 실시
	dataView.syncGridSelection(grid, true);

	//신규 버튼
	$('#btn_insert').click(function(){
		//편집중에는 제외
		if (!Slick.GlobalEditorLock.commitCurrentEdit()) {
			return;
		}

		//새 입력 항목을 포커스하도록 이벤트 발생
		grid.setActiveCell(dataView.getLength(), 1);
		$('.slick-row.active').children('.slick-cell.active').dblclick();
	});
	//삭제 버튼
	$('#btn_delete').click(function(){
		//선택된 위치 수집
		var selectedRows = grid.getSelectedRows(), ids = [];

		if(!selectedRows.length){
			msgbox('삭제할 항목을 선택해 주세요.', '삭제', {close:true});
			return;
		}

		//선택된 위치의 값 수집
		selectedRows.forEach(function(idx){
			var item = dataView.getItemByIdx(idx);
			if(item){
				ids.push(item.id);

				if(!item.isNew){
					//DB에 있는 항목만 삭제 대기열 추가
					commit.remove.push(item);
				}

				//삽입 및 수정 대기열 있으면 삭제
				var idx;
				if(~(idx=commit.insert.indexOf(item))){
					delete commit.insert[idx];
					commit.insert.length--;
				}
				if(~(idx=commit.update.indexOf(item))){
					delete commit.update[idx];
					commit.update.length--;
				}
				//console.log(commit);
			}
		});

		//일괄 삭제 실시
		dataView.beginUpdate();

		ids.forEach(function(id){
			dataView.deleteItem(id);
		});

		dataView.endUpdate();

	});
	//저장 버튼
	$('#btn_save').click(function(){

		//UPDATE 는 쓰레기 값이 들어가 있기 때문에 필터링 후 개수 세기.
		if(!(commit.insert.length + commit.update.filter(function(a){return a;}).length + commit.remove.length)){
			msgbox('저장할 항목이 없습니다.', '저장', {close:true});
			return;
		}

		//선택 상태 적용
		grid.getEditorLock().commitCurrentEdit();

		db.begin();
		//삽입
		commit.insert.forEach(function(item){
			if(!item){return;}
			db.query(
				"INSERT INTO insa VALUES (?,?,?,?,?,?,?,?)",
				item.id,
				item.name,
				item.gender,
				item.city,
				item.age,
				item.part,
				item.rank,
				item.join
				);
		});
		//수정
		commit.update.forEach(function(item){
			if(!item){return;}
			var q = [
			'UPDATE insa SET',
			'	 name = ? ',
			'	,gender = ? ',
			'	,city = ? ',
			'	,age = ? ',
			'	,part = ? ',
			'	,rank = ? ',
			'	,"join" = ? ',
			' WHERE id = ?'
			].join('\n');
			var values=[];
			db.query(
				q,
				item.name,
				item.gender,
				item.city,
				item.age,
				item.part,
				item.rank,
				item.join,
				item.id
				);
		});
		//삭제
		commit.remove.forEach(function(item){
			if(!item){return;}
			if(item && !isNaN(item.id)){
				db.query("DELETE FROM insa WHERE id = ?", item.id);
			}
		});
		//트랜잭션 실행
		db.execute(function(){
			//어자피 새로고침 할거니 취소버튼 기능 실행
			$('#btn_cancel').click();
		});
		beforeProcess(true);
		afterProcess.isSave = true;
	});
	//취소 버튼
	$('#btn_cancel').click(function(){
		//현재 편집중인 포커스 취소
		Slick.GlobalEditorLock.cancelCurrentEdit();
		// 변경내역 삭제
		for(var tn in commit){
			commit[tn].length = 0;
		}
		//다시 조회 실시
		db.query("SELECT * FROM insa").then(function(rs){
			// 데이터를 넣고 필터링을 정의 후 반영
			dataView.beginUpdate();
			dataView.setItems([]);
			for(var i=0,len=rs.rows.length;i<len;i++){
				var row = rs.rows.item(i), item = {};
				//row 객체 항목들이 읽기 전용이므로 쓰기 가능하도록 객체 복사
				//이거 안하면 수정이 안됨.
				for(var col in row){
					Object.defineProperty(item,col,{
						__proto__: null,
						value: row[col],
						writable: true,
						enumerable: true,
						configurable: false
					});
				}
				dataView.addItem(item);
			}
			dataView.setFilterArgs({
				name: form[0].elements.search.value
			});
			dataView.endUpdate();
			afterProcess();
		});
		beforeProcess();
	});
	//불러오거나 저장하기 전 프로세스
	function beforeProcess(save){
		if(beforeProcess.called){
			return;
		}else{
			beforeProcess.called = true;
		}
		$('button').prop('disabled',true);
		if(save){
			msgbox('저장 중...', '저장', {close:false});
		}
	}
	//불러오거나 저장한 후 프로세스
	function afterProcess(){

		$('button').prop('disabled',false);
		beforeProcess.called = false;

		if(afterProcess.isSave){
			msgbox('저장되었습니다.', '저장', {close:true});
			afterProcess.isSave = false;
		}else{
			msgbox.close();
		}
	}
});
