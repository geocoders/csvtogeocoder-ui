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
    var hasClass = function (el, name) {
        return el.className.length && new RegExp('(^|\\s)' + name + '(\\s|$)').test(el.className);
    };

    var addClass = function (el, name) {
        el.className = (el.className ? el.className + ' ' : '') + name;
    };

    var reader = new FileReader(), file, container, blob, parsed;
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
    createNode('h2', {className: 'step', id: 'next'}, container, '2. ' + _('Preview the file and check encoding'));
    var step2 = createNode('div', {className: 'step2'}, container);
    var previewContainer = createNode('table', {className: 'preview'}, step2);
    var helpEncoding = createNode('p', {id: 'helpEncoding'}, step2, _('If you see weird characters in the preview, you can try with another encoding: '));
    var selectEncoding = createNode('select', {}, helpEncoding);
    for (var i = 0; i < options.encodings.length; i++) {
        createNode('option', {value: options.encodings[i]}, selectEncoding, options.encodings[i]);
    }
    createNode('h2', {className: 'step'}, container, '3. ' + _('Choose the columns you want to use to compute the addresses'));
    var step3 = createNode('div', {className: 'step3'}, container);
    var helpColumns = createNode('p', {id: 'helpColumns'}, step3, _('Drag or click on a column to select it. You can then drag the selected columns to reorder them.'));
    var availableColumns = createNode('ul', {id: 'availableColumns'}, step3);
    var chosenColumns = createNode('ul', {id: 'chosenColumns'}, step3);
    var submitButton = createNode('input', {type: 'button', value: _('Geocode'), disabled: 'disabled'}, step3);

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
        xhr.overrideMimeType('text/csv; charset=' + getEncoding());
        var columns = document.querySelectorAll('#chosenColumns li');
        var formData = new FormData();
        for (var i = 0; i < columns.length; i++) {
            formData.append('columns', columns[i].id);
        }
        formData.append('data', blob, file.name);
        formData.append('encoding', getEncoding());
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
    var getEncoding = function () {
        return selectEncoding.options[selectEncoding.selectedIndex].value;
    };
    var processFile = function () {
        reader.readAsText(file, getEncoding());
        holder.innerHTML = '<strong>' + file.name + '</strong> (' + _('or drag another file here') + ', ' + _('or') + ' <a id="browseLink" href="#">' + _('browse') + '</a>)';
        listenBrowseLink();
    };
    var onFileDrop = function (e) {
        this.className = '';
        stop(e);
        file = e.dataTransfer.files[0];
        processFile();
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
        parsed = Papa.parse(reader.result, {header: true});
        PAPA = parsed;
        if (!parsed.data.length) return;
        var headers = parsed.meta.fields, column;
        availableColumns.innerHTML = '';
        chosenColumns.innerHTML = '';
        populatePreview();
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
        if (!hasClass(container, 'active')) addClass(container, 'active');
        window.location.hash = '#next';
    };
    var populatePreview = function () {
        previewContainer.innerHTML = '';
        var row = createNode('tr', {}, previewContainer);
        for (var i = 0; i < parsed.meta.fields.length; i++) {
            createNode('th', {}, row, parsed.meta.fields[i]);
        }
        for (i = 0; i < Math.min(parsed.data.length, 4); i++) {
            row = createNode('tr', {}, previewContainer);
            for (var j = 0; j < parsed.meta.fields.length; j++) {
                createNode('td', {}, row, parsed.data[i][parsed.meta.fields[j]]);
            }
        }
        helpEncoding.style.display = 'block';
    };

    var onSubmit = function (e) {
        stop(e);
        submit(file);
        return false;
    };
    var onColumnDragStart = function (e) {
        e.dataTransfer.effectAllowed = 'copy';
        e.dataTransfer.setData('text/plain', this.id);
    };
    var onColumnDropboxDragover = function (e) {
        stop(e);
        this.className = 'hover';
        e.dataTransfer.dropEffect = 'copy';
    };
    var onColumnDropboxDragleave = function (e) {
        stop(e);
        this.className = '';
    };
    var onColumnDropboxDrop = function (e) {
        this.className = '';
        stop(e);
        var el = document.getElementById(e.dataTransfer.getData('text/plain'));
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
        file = this.files[0];
        processFile();
    };
    var onSelectEncodingChange = function (e) {
        processFile();
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
    selectEncoding.addEventListener('change', onSelectEncodingChange, false);

};
