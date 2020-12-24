const html = `
<!DOCTYPE html>
<html>
<body>
    <hr/>
    <button style="font-size:300%" onclick="myFunction('askP1')">
    1 soru 
    </button>
    <br/>
    <button style="font-size:300%" onclick="myFunction('askP3')">
    3 soru 
    </button>
    <br/>
    <button style="font-size:300%" onclick="myFunction('askP5')">
    5 soru 
    </h1></button>
    <hr/>
    <p id="demo"></p>

    <script>
        function myFunction(value) {
            window.ReactNativeWebView.postMessage(value)
        }
    </script>

</body>

</html>
`;

export default html;
