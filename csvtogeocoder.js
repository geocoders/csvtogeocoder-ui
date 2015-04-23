var CSVToGeocoder = function (options) {
    options = options || {};
    options.i18n = options.i18n || {};

    var _ = function (k) {
        return options.i18n[k] || k;
    };

    var createNode = function (what, attrs, parent, content) {
        var el = document.createElement(what);
        for (var attr in attrs || {}) el[attr] = attrs[attr];
        if (typeof parent !== 'undefined') parent.appendChild(el);
        if (content) {
            if (content.nodeType && content.nodeType === 1) el.appendChild(content);
            else el.innerHTML = content;
        }
        return el;
    };

    var reader = new FileReader(), file, container, blob;
    READER = reader;
    if (options.container) {
        if (typeof options.container === 'string') container = document.querySelector(options.container);
        else container = options.container;
    } else {
        container = document.body;
    }
    var download = document.createElement('a');
    container.appendChild(download);
    download.style.display = 'none';
    container.setAttribute('class', (container.getAttribute('class') ? container.getAttribute('class') + ' ' : '') + 'csvtogeocoder');
    createNode('h2', {}, container, '1. ' + _('Choose a file'));
    var fileInput = createNode('input', {type: 'file', id: 'fileInput'}, container);
    var holder = createNode('div', {id: 'holder'}, container, _('Drag your file here') + ', ' + _('or') + ' <a id="browseLink" href="#">' + _('browse') + '</a>');
    createNode('h2', {}, container, '2. ' + _('Choose the columns to consider'));
    var availableColumns = createNode('ul', {id: 'availableColumns'}, container);
    var chosenColumns = createNode('ul', {id: 'chosenColumns'}, container);
    var submitButton = createNode('input', {type: 'button', value: _('Geocode'), disabled: 'disabled'}, container);

    var error = function (message) {
        console.error(message);
    };
    var stop = function (e) {
        e.stopPropagation();
        e.preventDefault();
    };
    var submit = function () {
        var progressBar = createNode('progress', {}, container);
        progressBar.max = 100;
        var xhr = new XMLHttpRequest();
        xhr.open('POST', options.postURL || '.');
        xhr.overrideMimeType('text/csv; charset=utf-8');
        var columns = document.querySelectorAll('#chosenColumns li');
        var formData = new FormData();
        for (var i = 0; i < columns.length; i++) {
            formData.append('columns', columns[i].id);
        }
        formData.append('data', blob, file.name);
        xhr.onreadystatechange = function() {
            if (xhr.readyState === 4) {
                progressBar.parentNode.removeChild(progressBar);
                if (xhr.status === 200) {
                    window.URL = window.URL || window.webkitURL;
                    var url = window.URL.createObjectURL(new Blob([xhr.responseText], {type: 'text/csv'}));
                    download.href = url;
                    download.download = downloadFileName();
                    download.click();
                } else {
                    error(_('Sorry, something went wrong…'));
                }
            }
        };
        xhr.upload.addEventListener('progress', function (e) {
            if (e.lengthComputable) {
                var percentage = Math.round((e.loaded * 100) / e.total);
                progressBar.value = percentage;
            }
        }, false);
        xhr.upload.addEventListener('load', function (){
                progressBar.removeAttribute('value');  // Switch to undeterminate state.
        }, false);
        xhr.send(formData);
        return false;
    };
    var processFile = function (f) {
        file = f;
        reader.readAsText(file);
        holder.innerHTML = '<strong>' + file.name + '</strong> (' + _('or drag another file here') + ', ' + _('or') + ' <a id="browseLink" href="#">' + _('browse') + '</a>)';
        listenBrowseLink();
    };
    var onFileDrop = function (e) {
        this.className = '';
        stop(e);
        processFile(e.dataTransfer.files[0]);
    };
    var onDragOver = function (e) {
        stop(e);
        this.className = 'hover';
    };
    var onDragLeave = function (e) {
        stop(e);
        this.className = '';
        return false;
    };
    var onDragEnter = function (e) {
        stop(e);
    };
    var onFileLoad = function () {
        var rawHeaders = reader.result.slice(0, reader.result.indexOf('\r\n') !== -1 ? reader.result.indexOf('\r\n') : reader.result.indexOf('\n')),
            separators = [',', ';', '|', ':', '\t'], currentCount = 0, separator, count;
        for (var i = 0; i < separators.length; i++) {
          count = (rawHeaders.match(new RegExp('\\' + separators[i],'g')) || []).length;
          if (count > currentCount) {
              currentCount = count;
              separator = separators[i];
          }
        }
        if (typeof separator === 'undefined') return;
        var headers = rawHeaders.split(separator), column;
        availableColumns.innerHTML = '';
        chosenColumns.innerHTML = '';
        for (var j = 0; j < headers.length; j++) {
            column = document.createElement('li');
            column.setAttribute('draggable', 'true');
            column.innerHTML = column.value = column.id = headers[j];
            column.ondragstart = onColumnDragStart;
            column.onclick = onColumnClick;
            column.ondrop = onColumnDrop;
            column.ondragover = onColumnDragOver;
            column.ondragleave = onColumnDragLeave;
            availableColumns.appendChild(column);
        }
        submitButton.disabled = false;
        blob = new Blob([reader.result], {type: 'text/csv'});
    };
    var onSubmit = function (e) {
        stop(e);
        submit(file);
        return false;
    };
    var onColumnDragStart = function (e) {
        e.dataTransfer.effectAllowed = 'copyMove';
        e.dataTransfer.setData('text/plain', this.id);
    };
    var onColumnDropboxDragover = function (e) {
        stop(e);
        this.className = 'hover';
        e.dataTransfer.dropEffect = 'copyMove';
    };
    var onColumnDropboxDragleave = function (e) {
        stop(e);
        this.className = '';
    };
    var onColumnDropboxDrop = function (e) {
        this.className = '';
        stop(e);
        var el = document.getElementById(e.dataTransfer.getData('text/plain'));
        el.parentNode.removeChild(el);
        chosenColumns.appendChild(el);
        return false;
    };
    var onColumnDrop = function (e) {
        stop(e);
        var el = document.getElementById(e.dataTransfer.getData('text/plain'));
        this.parentNode.insertBefore(el, this);
    };
    var onColumnClick = function (e) {
        this.className = '';
        var from, to;
        if (this.parentNode === chosenColumns) {
            from = chosenColumns;
            to = availableColumns;
        } else {
            from = availableColumns;
            to = chosenColumns;
        }
        from.removeChild(this);
        to.appendChild(this);
    };
    var onColumnDragOver = function (e) {
        this.className = 'hover';
    };
    var onColumnDragLeave = function (e) {
        this.className = '';
    };
    var onFileInputChange = function (e) {
        stop(e);
        processFile(this.files[0]);
    };
    var listenBrowseLink = function () {
        var browseLink = document.querySelector('#browseLink');
        var onBrowseLinkClick = function (e) {
            stop(e);
            fileInput.click();
        };
        browseLink.addEventListener('click', onBrowseLinkClick, false);
    };
    var downloadFileName = function () {
        // As we are in CORS ajax, we can't access the Content-Disposition header,
        // so built the file name from here.
        var name = file.name || 'file';
        if (name.indexOf('.csv', name.length - 4) !== -1) name = name.slice(0, name.length - 4);
        return name + '.geocoded.csv';
    };
    listenBrowseLink();
    reader.addEventListener('load', onFileLoad, false);
    holder.addEventListener('dragenter', onDragEnter, false);
    holder.addEventListener('dragover', onDragOver, false);
    holder.addEventListener('dragleave', onDragLeave, false);
    holder.addEventListener('drop', onFileDrop, false);
    submitButton.addEventListener('click', onSubmit, false);
    chosenColumns.addEventListener('dragover', onColumnDropboxDragover, false);
    chosenColumns.addEventListener('dragleave', onColumnDropboxDragleave, false);
    chosenColumns.addEventListener('drop', onColumnDropboxDrop, false);
    fileInput.addEventListener('change', onFileInputChange, false);

};
