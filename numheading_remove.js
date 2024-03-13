
function removeIndex() {
var indices = [];
jQuery(".ak-editor-content-area .ProseMirror").find("h1,h2,h3,h4,h5,h6").each(function(i,e) {            
    jQuery(this).html(removeNo(jQuery(this).html()));
});
}
    
function removeNo(str) {
let newstr = str.trim();
newstr = newstr.replace(/[\u00A0\u1680​\u180e\u2000-\u2009\u200a​\u200b​\u202f\u205f​\u3000]/g,' ');
if(IsNumeric(newstr.substring(0,newstr.indexOf(' ')))){
    return newstr.substring(newstr.indexOf(' ')+1).trim();
}
return newstr;
}

function IsNumeric(num) {
    num = num.split('.').join("");
    return (num >=0 || num < 0);
}

removeIndex();