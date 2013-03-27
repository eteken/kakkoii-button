$(function() {
    var socket = io.connect(location.protocol + '//' + location.host);
    $('#loginCommand').click(function(){
        $.oauthpopup({
            path: '/auth/twitter',
            callback: function(){
                alert('aaa');
                window.location.reload();
            }
        });
    });
    $('#coolButton').click(function() {
        socket.emit('cool', {
            eventId: '',
            count: Math.floor(Math.random() * 10)
        });
    });
    socket.on('cool', function(cool) {
        console.log(cool);
    });
});
