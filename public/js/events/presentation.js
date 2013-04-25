$(function() {
    var zapper = new Zapper({ from: 1 }) // PCからの利用
    , currentEvent
    , zaps = []
    , messages = []
    , $zapperIcons = $('#zapper-icons')
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
                $zapButton.removeAttr('disabled');
                zaps.push(zap);
                playAudio('arrived.mp3');

                (function() {
                    var zapAuthor = zap.author;
                    var authorId = zapAuthor._id;
                    console.log(authorId);
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
            });
            currentEvent.subscribe('message', function(message) {
                messages.push(message);
                onMessageArrived(message);
            });
            //            zaps = __lt_zaps__;
            messages = __lt_messages__;
            delete window.__lt_messages__;

            // メッセージを初期表示
            /*
              (function renderMessages() {
              var buf = [];
              for (var i = 0, n = messages.length; i < n; i++) {
              var message = messages[i];
              buf.push(common.renderMessage(message));
              }
              $('#messages').html(buf.join(''));
              })();
            */
        });
    }
    init();
    var onMessageArrived = function(message) {
        var html = common.renderMessage(message);
        $('.message:first').before(html);
        playAudio('arrived.mp3');
    };
    
    (function() {
        common.embedSlide({
            elemId: 'slide',
            slideId: $('#slideId').val(),
            width: $('#slide-container').width(),
            height: $('#slide-container').height(),
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
