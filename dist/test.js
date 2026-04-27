console.log("===== TEST SCRIPT LOADED =====");
document.addEventListener('DOMContentLoaded', function() {
    console.log("===== TEST SCRIPT DOMContentLoaded =====");
    const input = document.getElementById('confluenceSearchQuery');
    if (input) {
        input.value = "TEST SCRIPT WORKS!";
        console.log("===== TEST: Set input value =====");
    } else {
        console.log("===== TEST: Input not found =====");
    }
});
