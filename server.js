
var websocket = require('websocket').server;
var http = require('http');
var uuid = require('uuid');
var zeromq = require('zeromq');

var g_http_server;
var g_websock;

function init_websocket() {

    // init http server
    g_http_server = http.createServer(function(request, response) {
        console.log((new Date()) + ' Received request for ' + request.url);
        response.writeHead(404);
        response.end();
    });

    // listen http
    g_http_server.listen(8080, function() {
        console.log((new Date()) + " Server is listening on port 8080");
    });

    // open websocket
    g_websock = new websocket({
        httpServer: g_http_server,
        // You should not use autoAcceptConnections for production
        // applications, as it defeats all standard cross-origin protection
        // facilities built into the protocol and the browser.  You should
        // *always* verify the connection's origin and decide whether or not
        // to accept it.
        autoAcceptConnections: false
    });
    
    g_websock.on('request', function(request) {
        
        var connection = request.accept();
        console.log((new Date()) + ' Connection accepted.');

        connection.id = uuid.v4();
        console.log("connected id " + connection.id);

        // create zeromq
        var sock = zeromq.socket('sub');
        let ret = sock.connect('tcp://localhost:8082');
        console.log('Subscriber connected to port 8082. ret: ' + ret.identity);

        sock.on('message', function(topic, message) {
            message_handler(connection, topic, message);
        });
        
        connection.on('message', function(message) {

            sock.on('message', function(topic, message) {
                message_handler(connection, topic, message);
            });
    
            if (message.type === 'utf8') {
                console.log('Received Message: ' + connection.id + ', ' + message.utf8Data);
                
                let j_data = null;
                // connection.sendUTF(message.utf8Data);
                try {
                    j_data = JSON.parse(message.utf8Data);
                }
                catch (e) {
                    console.log("Error. " + e);
                    return;
                }
                
                if(j_data["subscribe"] == true) {
                    console.log("Subscribe: " + j_data["topic"]);
                    sock.subscribe(j_data["topic"]);
                }
                else if(j_data["subscribe"] == false) {
                    sock.unsubscribe(j_data["topic"]);
                }
                else {
                    console.log("Wrong option.");
                }                
            }
            else {
            }
        });

        connection.on('close', function(reasonCode, description) {
            console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.');
            sock.close();
        });
    });
}

/**
 * zeromq message handler.
 * broadcast data to websocket.
 * @param  {[type]} topic   [description]
 * @param  {[type]} message [description]
 * @return {[type]}         [description]
 */
function message_handler(connection, topic, message) {
    console.log("Received message:", topic.toString(), message.toString());

    j_data = {};
    j_data[topic.toString()] =  JSON.parse(message.toString());

    if(connection != null) {
        connection.sendUTF(JSON.stringify(j_data));
    }
}
  
/**
 * [zmq_init description]
 * @return {[type]} [description]
 */
function zmq_init() {
    // subscribe
    zmq = require('zeromq')
    sock = zmq.socket('sub');
   
    sock.connect('tcp://localhost:8082');
    
    sock.subscribe("/");
    console.log('Subscriber connected to port 8082');
    sock.on('message', function(topic, message) {
      message_handler(null, topic, message);
    });
  };

  
function init() {
    init_websocket();
    // zmq_init();
}

init();