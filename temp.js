var output='';
model.product.tags.forEach(function(tag){ var model= {tag:tag};
if(true){
output+='<li';output+='>';output+='  ' + model.tag;
output+='</li>';
}.bind(this));}return output;