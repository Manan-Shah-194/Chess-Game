const socket = io();

socket.emit("message")
socket.on("Sev Puri", function(){
    console.log("Sev Puri delivered");
});