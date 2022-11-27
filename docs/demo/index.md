---
title: Live Python in the Browser
layout: react
is_react: True
hero_image: ../images/index_hero.jpg
---
This is a demonstration of Live Coding in Python. Type some Python code in the
editor on the left side. The right side is a live coding display that shows
what happens inside your code when it runs. It shows variable values and print()
calls, as well as a new column each time it runs through a loop or a function.

    def search(n, a):
        low = 0
        high = len(a) - 1
        while low <= high:
            mid = low + high // 2
            v = a[mid]
            if n == v:
                return mid
            if n < v:
                high=mid - 1
            else:
                low=mid + 1
        return -1
    
    i = search(1, [1, 2, 4])
    print(i)

Change the code, and see the changes inside. Try to find the bug in the example
code. (Hint: try searching for different numbers.) Paste your own code to see
how it works.

# Graphics
Instead of showing what happens inside your code, there's also an option to show
turtle graphics, matplotlib graphs, and other types of graphics that update as
the reader changes your code.

    ### Canvas ###
    import turtle as t
    
    t.bgcolor('ivory')
    t.fillcolor('blue')
    t.begin_fill()
    for _ in range(4):
        t.forward(100)
        t.right(90)
    t.end_fill()
    
    t.mainloop()

The `mainloop()` call doesn't do anything here, but it lets you copy the code
and run it in Python. Without `mainloop()`, the turtle window immediately
closes.

# Tutorials
This is a prototype for a new kind of Python tutorial where all of the code
examples include a live coding display beside them. When you make changes to
the code, the live coding display shows what happens as the code runs. It shows
what's in each variable, and it adds a column each time a loop or a function
runs.

Some code samples are challenges that include a goal for you. You have to
edit the code until your output matches the goal output. The bar above the goal
will turn from red to green as you get closer to matching.

This prototype is based on an early section of the official [Python tutorial].
Please try it out, and then send me your feedback at the bottom. You can also
read the [complete tutorial] with live code samples.

[Python tutorial]: https://docs.python.org/3/tutorial/controlflow.html
[complete tutorial]: ?tutorial=cpython/controlflow

## for Statements

The `for` statement in Python differs a bit from what you may be used
to in C or Pascal.  Rather than always iterating over an arithmetic progression
of numbers (like in Pascal), or giving the user the ability to define both the
iteration step and halting condition (as C), Python's `for` statement
iterates over the items of any sequence (a list or a string), in the order that
they appear in the sequence.  For example:

    # Measure some strings:
    words = ['cat', 'window', 'defenestrate']
    for w in words:
        print(w, len(w))

Code that modifies a collection while iterating over that same collection can
be tricky to get right.  Instead, it is usually more straight-forward to loop
over a copy of the collection or to create a new collection:

    users = {'alice': 'active', 'bob': 'inactive'}
    
    # Strategy:  Create a new collection
    active_users = {}
    for user, status in users.items():
        if status == 'active':
            active_users[user] = status
    print(active_users)
    
    # Strategy:  Iterate over a copy
    for user, status in users.copy().items():
        if status == 'inactive':
            del users[user]
    print(users)

### The range Function
If you do need to iterate over a sequence of numbers, the built-in function
`range` comes in handy.  It generates arithmetic progressions. Try changing
this code so that the output on the lower right matches the goal below. The live
coding display on the upper right shows you what's happening as your code runs.

    for i in range(5):
        print(i)
    print('---')
    for i in range(5):
        print(i)
    print('---')
    for i in range(5):
        print(i)
    
    ### Goal ###
    for i in range(5):
        print(i)
    print('---')
    for i in range(2):
        print(i)
    print('---')
    for i in range(7):
        print(i)

## Turtle Tutorial
How about a goal for a canvas code sample? Can you change the blue square into
a yellow triangle?


    ### Canvas ###
    import turtle as t
    
    t.bgcolor('ivory')
    t.fillcolor('blue')
    t.begin_fill()
    for _ in range(4):
        t.forward(100)
        t.right(90)
    t.end_fill()
    
    t.mainloop()
    
    ### Goal ###
    import turtle as t
    
    t.bgcolor('ivory')
    t.fillcolor('yellow')
    t.begin_fill()
    for _ in range(3):
        t.forward(100)
        t.right(120)
    t.end_fill()

For a longer turtle tutorial, see the [flag tutorial].

[flag tutorial]:  ?tutorial=flags/romania-colombia

# Feedback
Thanks for trying out this prototype of the live coding tutorial. I'd love to
hear how it worked for you. If you're new to Python, did you learn something?
Did you try the challenge, and did you solve it? Was it too easy or too hard?
Did the live coding display make sense? Did anything not work in your browser?
Was the page slow to load?

If anything was broken, please create an [issue]. For any other feedback, please
send me a message on [twitter] or [e-mail]. I'd love it if you told your friends
to try it.

# Write your own
You can fork the whole repository and just edit the markdown files to write your
own tutorials. Look at the existing tutorials for examples of all the features,
or read about them in the `CONTRIBUTING.md` file.

[issue]: https://github.com/donkirkby/live-py-plugin/issues
[twitter]: https://twitter.com/donkirkby
[e-mail]: mailto:donkirkby@gmail.com