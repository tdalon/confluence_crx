function addIndex() {
var indices = [];
jQuery(".ak-editor-content-area .ProseMirror").find("h1,h2,h3,h4,h5,h6").each(function(i,e) {
    var hIndex = parseInt(this.nodeName.substring(1)) - 1;
    if (indices.length - 1 > hIndex) {
        indices= indices.slice(0, hIndex + 1 );
    }
    if (indices[hIndex] == undefined) {
        indices[hIndex] = 0;
    }
    
    if (jQuery(this).html().toLowerCase() !== "table of contents"){
        indices[hIndex]++;
        jQuery(this).html(indices.join(".")+". " + removeNo(jQuery(this).html()));
    }
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

addIndex();