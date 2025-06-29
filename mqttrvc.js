const ws = new WebSocket('ws://100.110.189.122:9001/mqtt', 'mqttv3.1');

ws.onopen = function () {
    console.log('WebSocket connection established');
    
    // Subscribe to MQTT topic
    ws.send('RVC/DC_DIMMER_COMMAND_2/46');
    
    // Publish MQTT message
    ws.send('{"command":3,"command definition":"off","data":"2EFF6E03FF00FFFF","delay/duration":255,"desired level":55,"dgn":"1FEDB","group":"11111111","instance":46,"interlock":"00","interlock definition":"no interlock active","name":"DC_DIMMER_COMMAND_2","timestamp":"1743883946.829915"}');
};

ws.onmessage = function (event) {
    console.log('Received message: ' + event.data);
};
