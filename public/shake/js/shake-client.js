$(function() {
    var socket = io.connect(location.protocol + '//' + location.host + '/shake');
    var state;
    socket.on('state', function (value) {
        state = value;
    });
    socket.on('result', function(result) {
        var counts = result.counts;
        var myCount = result.counts[socket.id].value;
        console.log(result);
    });
    $('#shake-button').click(function() {
        socket.emit('shake', 1);
    });
});
