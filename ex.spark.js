define(function() {
    var template = {
        models: [],
        render: function(model) {
            var output = '';
            output += '<label';
            output += '>';
            output += '  test';
            output += '</label>';
            return output;
        }
    }; /*end template*/
    ;
    return template;
});