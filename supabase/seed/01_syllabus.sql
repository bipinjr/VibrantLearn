-- Syllabus seed v1 (2026-10-08).
-- Source: compiled by the VibrantLearn team from the usual BCU BCA unit structure.
-- NOT yet checked line-by-line against the official BCU SEP syllabus PDF: the `source` column says
-- so, and the UI shows these as "unverified" until a teammate verifies and bumps `version`.
-- weightage = exam priority 1-10 (10 = almost always asked), difficulty 1-3, est_minutes = first pass.

create temporary table _t (
  subject text, unit smallint, unit_title text, ord smallint, topic text,
  subtopics text[], weightage smallint, difficulty smallint, est_minutes smallint
);

insert into _t values
-- Java Programming ----------------------------------------------------------------------------
('Java Programming',1,'Introduction to Java',1,'Features of Java and the JVM',array['Platform independence','JDK, JRE and JVM','Bytecode'],8,1,30),
('Java Programming',1,'Introduction to Java',2,'Data types, variables and operators',array['Primitive types','Type casting','Operator precedence'],6,1,35),
('Java Programming',1,'Introduction to Java',3,'Control statements',array['if / switch','for, while, do-while','break and continue'],6,1,35),
('Java Programming',1,'Introduction to Java',4,'Arrays and strings',array['1D and 2D arrays','String vs StringBuffer','Common String methods'],7,2,45),
('Java Programming',2,'Classes and objects',1,'Classes, objects and methods',array['Defining a class','Creating objects','Method overloading'],9,1,40),
('Java Programming',2,'Classes and objects',2,'Constructors',array['Default and parameterised','Constructor overloading','this keyword'],9,1,35),
('Java Programming',2,'Classes and objects',3,'Static members and access specifiers',array['static variables and methods','public, private, protected, default'],7,2,30),
('Java Programming',2,'Classes and objects',4,'Garbage collection and finalize',array['How GC works','finalize()'],4,1,20),
('Java Programming',3,'Inheritance and polymorphism',1,'Inheritance and its types',array['Single, multilevel, hierarchical','super keyword','Why no multiple inheritance with classes'],10,2,45),
('Java Programming',3,'Inheritance and polymorphism',2,'Method overriding and dynamic dispatch',array['Overriding rules','Runtime polymorphism','Overloading vs overriding'],10,2,45),
('Java Programming',3,'Inheritance and polymorphism',3,'Abstract classes and final',array['abstract methods','final variables, methods, classes'],8,2,35),
('Java Programming',3,'Inheritance and polymorphism',4,'Interfaces',array['Defining and implementing','Multiple inheritance with interfaces','default methods'],9,2,40),
('Java Programming',3,'Inheritance and polymorphism',5,'Packages',array['Creating packages','import','CLASSPATH'],7,2,30),
('Java Programming',4,'Exceptions and multithreading',1,'Exception handling',array['try, catch, finally','throw and throws','Checked vs unchecked'],10,2,45),
('Java Programming',4,'Exceptions and multithreading',2,'User-defined exceptions',array['Extending Exception','When to create one'],6,2,25),
('Java Programming',4,'Exceptions and multithreading',3,'Threads and the thread life cycle',array['Thread class vs Runnable','Thread states','sleep, join'],9,3,50),
('Java Programming',4,'Exceptions and multithreading',4,'Synchronization',array['synchronized methods and blocks','wait, notify'],7,3,40),
('Java Programming',5,'Applets, AWT and I/O',1,'Event handling',array['Delegation event model','Listeners and adapters'],7,2,40),
('Java Programming',5,'Applets, AWT and I/O',2,'AWT controls and layouts',array['Button, Label, TextField','FlowLayout, BorderLayout, GridLayout'],6,2,40),
('Java Programming',5,'Applets, AWT and I/O',3,'Streams and file handling',array['Byte vs character streams','FileReader and FileWriter'],7,2,40),
-- Python Programming --------------------------------------------------------------------------
('Python Programming',1,'Python basics',1,'Features of Python and the interpreter',array['Interactive vs script mode','Indentation'],6,1,25),
('Python Programming',1,'Python basics',2,'Data types, variables and operators',array['int, float, str, bool','Type conversion','Operators'],7,1,35),
('Python Programming',1,'Python basics',3,'Control flow',array['if-elif-else','for and while','break, continue, pass'],7,1,35),
('Python Programming',2,'Functions and modules',1,'Functions',array['Arguments: positional, keyword, default','*args and **kwargs','Return values'],9,2,45),
('Python Programming',2,'Functions and modules',2,'Scope, recursion and lambda',array['Local vs global','Recursive functions','lambda, map, filter'],8,2,40),
('Python Programming',2,'Functions and modules',3,'Modules and packages',array['import forms','Standard library modules','Creating a module'],6,1,30),
('Python Programming',3,'Data structures in Python',1,'Strings',array['Slicing','String methods','Formatting'],7,1,35),
('Python Programming',3,'Data structures in Python',2,'Lists and tuples',array['List methods','Comprehensions','Tuple immutability'],10,1,45),
('Python Programming',3,'Data structures in Python',3,'Dictionaries and sets',array['Dict methods','Set operations'],9,2,40),
('Python Programming',4,'Files and exceptions',1,'File handling',array['open modes','read, write, with statement','CSV files'],8,2,40),
('Python Programming',4,'Files and exceptions',2,'Exception handling',array['try-except-else-finally','raise','Custom exceptions'],9,2,40),
('Python Programming',5,'Object-oriented Python',1,'Classes and objects',array['__init__','Instance vs class variables'],9,2,40),
('Python Programming',5,'Object-oriented Python',2,'Inheritance and polymorphism',array['Single and multiple inheritance','Method overriding','super()'],9,2,45),
('Python Programming',5,'Object-oriented Python',3,'Operator overloading and dunder methods',array['__str__, __len__','__add__'],5,3,30),
-- Database Management Systems -----------------------------------------------------------------
('Database Management Systems',1,'Introduction',1,'File system vs DBMS',array['Drawbacks of file systems','Advantages of DBMS'],8,1,30),
('Database Management Systems',1,'Introduction',2,'Three-schema architecture and data independence',array['External, conceptual, internal','Logical vs physical independence'],9,2,40),
('Database Management Systems',1,'Introduction',3,'DBMS users and DBA roles',array['Types of users','Responsibilities of a DBA'],5,1,20),
('Database Management Systems',2,'ER model',1,'Entities, attributes and relationships',array['Attribute types','Cardinality','Participation'],10,2,45),
('Database Management Systems',2,'ER model',2,'ER diagrams',array['Weak entities','Drawing an ER diagram for a case'],10,2,50),
('Database Management Systems',2,'ER model',3,'Keys',array['Super, candidate, primary, foreign'],9,1,30),
('Database Management Systems',3,'Relational model and SQL',1,'Relational algebra',array['Select, project, join','Set operations'],8,3,50),
('Database Management Systems',3,'Relational model and SQL',2,'SQL DDL and DML',array['CREATE, ALTER, DROP','INSERT, UPDATE, DELETE','Constraints'],10,1,45),
('Database Management Systems',3,'Relational model and SQL',3,'SQL queries: joins, grouping, subqueries',array['Inner and outer joins','GROUP BY, HAVING','Nested queries'],10,2,60),
('Database Management Systems',3,'Relational model and SQL',4,'Views',array['Creating views','Updatable views'],6,2,25),
('Database Management Systems',4,'Normalization',1,'Functional dependencies',array['Armstrong''s axioms','Closure'],8,3,45),
('Database Management Systems',4,'Normalization',2,'Normal forms 1NF to BCNF',array['Anomalies','1NF, 2NF, 3NF','BCNF'],10,3,60),
('Database Management Systems',5,'Transactions',1,'ACID properties and transaction states',array['Atomicity to durability','State diagram'],10,2,40),
('Database Management Systems',5,'Transactions',2,'Concurrency control',array['Lost update problem','Locking, two-phase locking'],8,3,45),
('Database Management Systems',5,'Transactions',3,'Recovery and deadlocks',array['Log-based recovery','Deadlock detection and prevention'],7,3,40),
-- Data Structures -----------------------------------------------------------------------------
('Data Structures',1,'Introduction',1,'Types of data structures and complexity',array['Linear vs non-linear','Big O notation'],8,2,40),
('Data Structures',1,'Introduction',2,'Arrays and operations',array['Traversal, insertion, deletion','2D arrays'],7,1,35),
('Data Structures',2,'Searching and sorting',1,'Linear and binary search',array['Algorithm and complexity'],9,1,35),
('Data Structures',2,'Searching and sorting',2,'Bubble, selection and insertion sort',array['Passes','Complexity'],9,2,45),
('Data Structures',2,'Searching and sorting',3,'Merge sort and quick sort',array['Divide and conquer','Partitioning'],8,3,50),
('Data Structures',3,'Stacks and queues',1,'Stack operations',array['Push, pop, peek','Array implementation'],10,1,35),
('Data Structures',3,'Stacks and queues',2,'Applications of stacks',array['Infix to postfix','Postfix evaluation','Recursion'],10,2,50),
('Data Structures',3,'Stacks and queues',3,'Queues and circular queues',array['Enqueue, dequeue','Circular queue','Priority queue'],9,2,45),
('Data Structures',4,'Linked lists',1,'Singly linked list',array['Insert and delete at positions','Traversal'],10,2,55),
('Data Structures',4,'Linked lists',2,'Doubly and circular linked lists',array['Node structure','Operations'],8,3,45),
('Data Structures',5,'Trees and graphs',1,'Binary trees and traversals',array['Inorder, preorder, postorder','Tree terminology'],10,2,50),
('Data Structures',5,'Trees and graphs',2,'Binary search trees',array['Insert, delete, search'],9,3,50),
('Data Structures',5,'Trees and graphs',3,'Graph representation and traversal',array['Adjacency matrix and list','BFS and DFS'],8,3,50),
-- Computer Networks ---------------------------------------------------------------------------
('Computer Networks',1,'Introduction',1,'Network types and topologies',array['LAN, MAN, WAN','Bus, star, ring, mesh'],8,1,30),
('Computer Networks',1,'Introduction',2,'OSI and TCP/IP models',array['Seven layers and their jobs','Comparison'],10,2,50),
('Computer Networks',2,'Physical layer',1,'Transmission media',array['Guided and unguided media'],7,1,30),
('Computer Networks',2,'Physical layer',2,'Multiplexing and switching',array['FDM, TDM','Circuit vs packet switching'],7,2,40),
('Computer Networks',3,'Data link layer',1,'Error detection and correction',array['Parity, CRC','Hamming code'],9,3,50),
('Computer Networks',3,'Data link layer',2,'Flow control and MAC protocols',array['Stop-and-wait, sliding window','ALOHA, CSMA/CD'],8,3,50),
('Computer Networks',4,'Network layer',1,'IP addressing and subnetting',array['IPv4 classes','Subnet masks','IPv6 basics'],10,3,60),
('Computer Networks',4,'Network layer',2,'Routing algorithms',array['Distance vector','Link state'],8,3,45),
('Computer Networks',5,'Transport and application layers',1,'TCP and UDP',array['Three-way handshake','Congestion control basics'],9,2,45),
('Computer Networks',5,'Transport and application layers',2,'DNS, HTTP, SMTP',array['How DNS resolves','HTTP request/response'],7,1,35),
-- Operating Systems ---------------------------------------------------------------------------
('Operating Systems',1,'Introduction',1,'Functions and types of operating systems',array['Batch, time-sharing, real-time','System calls'],8,1,35),
('Operating Systems',2,'Process management',1,'Processes, PCB and process states',array['State diagram','Context switch'],10,2,40),
('Operating Systems',2,'Process management',2,'CPU scheduling algorithms',array['FCFS, SJF, priority, round robin','Gantt charts and waiting time'],10,3,60),
('Operating Systems',2,'Process management',3,'Threads',array['User vs kernel threads','Multithreading models'],6,2,30),
('Operating Systems',3,'Synchronization and deadlocks',1,'Critical section and semaphores',array['Race conditions','Producer-consumer'],9,3,50),
('Operating Systems',3,'Synchronization and deadlocks',2,'Deadlocks and the banker''s algorithm',array['Necessary conditions','Avoidance with banker''s algorithm'],10,3,60),
('Operating Systems',4,'Memory management',1,'Paging and segmentation',array['Page tables','Fragmentation'],9,3,50),
('Operating Systems',4,'Memory management',2,'Virtual memory and page replacement',array['Demand paging','FIFO, LRU, optimal'],10,3,55),
('Operating Systems',5,'File systems and disks',1,'File allocation methods',array['Contiguous, linked, indexed'],7,2,35),
('Operating Systems',5,'File systems and disks',2,'Disk scheduling',array['FCFS, SSTF, SCAN, C-SCAN'],8,2,40);

-- One syllabus row per subject. Semesters are our best mapping and part of the "unverified" note.
insert into public.syllabi (university, course, semester, scheme, subject, version, source)
values
  ('Bengaluru City University','BCA',3,'SEP','Java Programming','v1','draft-v1: team-compiled, unverified against official BCU SEP PDF'),
  ('Bengaluru City University','BCA',3,'SEP','Database Management Systems','v1','draft-v1: team-compiled, unverified against official BCU SEP PDF'),
  ('Bengaluru City University','BCA',2,'SEP','Data Structures','v1','draft-v1: team-compiled, unverified against official BCU SEP PDF'),
  ('Bengaluru City University','BCA',2,'SEP','Python Programming','v1','draft-v1: team-compiled, unverified against official BCU SEP PDF'),
  ('Generic','Any',0,'Other','Computer Networks','v1','draft-v1: generic undergraduate outline'),
  ('Generic','Any',0,'Other','Operating Systems','v1','draft-v1: generic undergraduate outline');

insert into public.syllabus_topics
  (syllabus_id, unit, unit_title, ord, topic, subtopics, weightage, difficulty, est_minutes, keywords)
select s.id, t.unit, t.unit_title, t.ord, t.topic, t.subtopics, t.weightage, t.difficulty, t.est_minutes,
       array[lower(t.topic)] || array(select lower(x) from unnest(t.subtopics) x)
from _t t
join public.syllabi s on s.subject = t.subject and s.version = 'v1';

drop table _t;
