$(function() {
//    var socket = io.connect(location.protocol + '//' + location.host + '/result');
    var clientCount;
    var Mode = {
        HARD: 60,
        NORMAL: 40,
        EASY: 20
    };
    var mode = Mode.NORMAL;
    var pixelCount;
    var currentPixel;
    var colorPixelPerShake;
/*    
    socket.on('info', function(info) {
        clientCount = info.clientCount;
    });
    socket.on('add client', function(count) {
        clientCount += count;
    });
    socket.on('progress', function(progress) {
        doProgress(progress.count);
    });*/
    
    var canvas = document.getElementById('canvas');
    var ctx;
    var grayImageData, colorImageData;
    
    var imgUrl = 'img/kakkoii0.png';
    var img = new Image();
    img.src = imgUrl;
    
    img.onload = function() {
        var width = canvas.width = img.naturalWidth;
        var height = canvas.height = img.naturalHeight;
        pixelCount = width * height;
        currentPixel = pixelCount - 1;

        ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        grayImageData = ctx.getImageData(0, 0, width, height);
        colorImageData = ctx.getImageData(0, 0,width, height);

        // グレースケールに変換する
        var data = grayImageData.data;
        for(var i = 0; i < data.length; i += 4) {
            var brightness = 0.34 * data[i] + 0.5 * data[i + 1] + 0.16 * data[i + 2];
            // red
            data[i] = brightness;
            // green
            data[i + 1] = brightness;
            // blue
            data[i + 2] = brightness;
        }
        ctx.putImageData(grayImageData, 0, 0);
        colorPixelPerShake = width * 4;
    };
    var startTime, timer;
    $('#start-button').click(function() {
        startTime = Date.now();
        $('#shake-button, #stop-button').removeAttr('disabled');
        $(this).attr('disabled');
        timer = setInterval(function() {
            var now = Date.now();
            var time = now - startTime;
            var seconds = (time / 1000);
            $('#time').text(seconds);
        }, 100);
    });
    $('#stop-button').click(function() {
        $('#shake-button, #stop-button').attr('disabled');
        $('#start-button').removeAttr('disabled');
        clearInterval(timer);
    });
    
    $('#shake-button').click(function() {
        /*
        count += 4;

        var target = count;
        
        var width = canvas.width;
        var height = canvas.height;
        var data = grayImageData.data;
        var colorData = colorImageData.data;
        for (var row = height; row > 0; row--) {
            target--;
            if (target === 0) {
                break;
            }
            for (var col = width; col > 0; col--) {
                var index = (row - 1) * width + col;
                var dataIndex = index * 4;
                data[dataIndex] = colorData[dataIndex];
                data[dataIndex + 1] = colorData[dataIndex + 1];
                data[dataIndex + 2] = colorData[dataIndex + 2];
                data[dataIndex + 3] = colorData[dataIndex + 3];
                console.log(1);
            }
        }
        ctx.putImageData(grayImageData, 0, 0);
        */
        doProgress(1);
    });
    
    function start() {
        /*
        socket.emit('command', { type: start }, function() {
            colorPixelPerShake = Math.floor(pixelCount / mode / clientCount);
            onStart();
        });
        */
    }
    function onStart() {
    }
    function onEnd() {
        $('#stop-button').click();
        alert('完了しました');
    }
    function doProgress(count) {
        var data = grayImageData.data;
        var colorData = colorImageData.data;
        var targetIndex = currentPixel - count * colorPixelPerShake;
        if (targetIndex < 0) {
            targetIndex = 0;
        }
        for (var i = currentPixel; i >= targetIndex; i--) {
            var dataIndex = i * 4;
            data[dataIndex] = colorData[dataIndex];
            data[dataIndex + 1] = colorData[dataIndex + 1];
            data[dataIndex + 2] = colorData[dataIndex + 2];
            data[dataIndex + 3] = colorData[dataIndex + 3];
        }
        currentPixel = targetIndex;
        var percentage = (pixelCount - currentPixel) / pixelCount;
        var ended = false;
        if (currentPixel <= 0) {
            percentage = 1;
            ended = true;
        }
        $('#percentage').text(Math.floor(percentage * 100));
        $('#progress').attr('value', percentage);
        ctx.putImageData(grayImageData, 0, 0);
        if (ended) {
            onEnd();
        }
    }
});
