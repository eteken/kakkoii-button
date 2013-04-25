$(function() {
    var zapper = new Zapper({ from: 1 }) // PCからの利用
    , currentEvent
//    , zaps = []
//    , messages = []
    , notifications = []
    , $notifications = $('#notifications')
    , slidePlayer;

    var playAudio = (function() {
        var audioFiles = [
            'arrived.mp3'
        ];
        var audioElems = {
        };
        for (var i = 0; i < audioFiles.length; i++) {
            var audioFileName = audioFiles[i];
            var audio = new Audio();
            audio.src = '/media/' + audioFileName;
            audioElems[audioFileName] = audio;
        }
        return function(audioFileName) {
            var audioElem = audioElems[audioFileName];
            audioElem.play();
        };
    })();
    
    function init() {
        zapper.connect(function(err) {
            if (err) {
                console.log(err);
                alert('エラーが発生しました。' + err.message);
                return;
            }
            currentEvent = zapper.event(__lt_event__);
            currentEvent.subscribe('zap', function(zap) {
//                playAudio('arrived.mp3');
                notifications.push({
                    type: 'zap',
                    value: zap
                });
                /*
                (function() {
                    var zapAuthor = zap.author;
                    var authorId = zapAuthor._id;
                    var $listItems = $zapperIcons.children();
                    for (var i = 0, n = $listItems.length; i < n; i++) {
                        var $li = $($listItems[i]);
                        if ($li.data('author')._id === authorId) {
                            $li.remove();
                            break;
                        }
                    }
                    var $li = $(document.createElement('li'));
                    $li.data('author', zapAuthor);
                    $li.on('webkitAnimationEnd mozAnimationEnd oAnimationEnd msAnimationEnd animationend', function() {
                        $(this).remove();
                    });
                    var $img = $(document.createElement('img'));
                    $img.attr('src', zapAuthor.photo);
                    $img.addClass('icon').appendTo($li);
                    $zapperIcons.append($li);
                })();
                */
            });
            currentEvent.subscribe('message', function(message) {
                notifications.push({
                    type: 'message',
                    value: message
                });
            });
            setInterval(function() {
                while (notifications.length > 0) {
                    var data = notifications.shift();
                    var value = data.value;
                    var author = value.author;
                    var $li = $(document.createElement('li'));

                    if (data.type === 'zap') {
                        for (var i = 0, n = value.count; i < n; i++) {
                            var $icon = $(document.createElement('img'));
                            $icon.addClass('icon').attr({
                                src: author.photo
                            });
                            $li.append($icon);
                        }
                    } else if (data.type === 'message') {
                        var $icon = $(document.createElement('img'));
                        $icon.addClass('icon').attr({
                            src: author.photo
                        });
                        var $message = $(document.createElement('span'));
                        $message
                            .addClass('message')
                            .text(value.text);
                        $li.append($icon).append($message);
                    }
                    
                    $li.on('webkitAnimationEnd mozAnimationEnd oAnimationEnd msAnimationEnd animationend', function() {
                        $(this).remove();
                    });
                    $li.appendTo($notifications);
                }
            }, 300);
        });
    }
    init();
    (function() {
        common.embedSlide({
            elemId: 'slide',
            slideId: $('#slideId').val(),
            autoResize: true,
            onsuccess: function(elem) {
                slidePlayer = elem;
                var prevSlide;
                setInterval(function() {
                    var currentSlide = slidePlayer.getCurrentSlide();
                    if (currentSlide !== prevSlide) {
                        prevSlide = currentSlide;
                        currentEvent.send('sync-slide', { slide: currentSlide });
                    }
                }, 500);
            },
            onerror: function() {
                alert('エラー');
            }
        });
    })();
});
